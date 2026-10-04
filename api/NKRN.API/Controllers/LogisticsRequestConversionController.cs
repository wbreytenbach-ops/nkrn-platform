using System.Data;
using System.Data.Common;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NKRN.API.Data;
using NKRN.API.Models;
using NKRN.API.Services;

namespace NKRN.API.Controllers
{
    [ApiController]
    [Route("api/LogisticsRequests")]
    [Authorize]
    public class LogisticsRequestConversionController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        private readonly LogisticsRequestNotificationService _notifications;

        private static readonly HashSet<string> AllowedPriorities =
            new(StringComparer.OrdinalIgnoreCase)
            {
                "Low",
                "Medium",
                "High",
                "Critical"
            };

        private static readonly HashSet<string> FinalRequestStatuses =
            new(StringComparer.OrdinalIgnoreCase)
            {
                "Converted",
                "Completed",
                "Done",
                "Cancelled",
                "Declined"
            };

        public LogisticsRequestConversionController(
            ApplicationDbContext context, LogisticsRequestNotificationService notifications)
        {
            _context = context;
            _notifications = notifications;
        }

        [HttpPost("{id:int}/convert")]
        public async Task<IActionResult> ConvertToTask(
            int id,
            [FromBody] ConvertLogisticsRequestToTaskRequest request)
        {
            if (!await CanManageLogisticsAsync())
            {
                return Forbid();
            }

            var userID = GetLoggedInUserID();

            if (userID == null)
            {
                return Unauthorized();
            }

            if (request == null)
            {
                return BadRequest(new
                {
                    message = "Conversion information is required."
                });
            }

            var priority =
                string.IsNullOrWhiteSpace(request.Priority)
                    ? "P3"
                    : request.Priority.Trim().ToUpperInvariant();

            if (!AllowedPriorities.Contains(priority))
            {
                return BadRequest(new
                {
                    message = "Prioriteit moet Low, Medium, High of Critical wees."
                });
            }

            if (request.DepartmentID.HasValue)
            {
                var departmentExists =
                    await _context.LogisticsDepartments
                        .AsNoTracking()
                        .AnyAsync(department =>
                            department.DepartmentID ==
                                request.DepartmentID.Value &&
                            department.IsActive);

                if (!departmentExists)
                {
                    return BadRequest(new
                    {
                        message =
                            "The selected Logistics department does not exist or is inactive."
                    });
                }
            }

            if (request.ResponsibleWorkerID.HasValue)
            {
                var workerExists =
                    await _context.LogisticsWorkers
                        .AsNoTracking()
                        .AnyAsync(worker =>
                            worker.WorkerID ==
                                request.ResponsibleWorkerID.Value &&
                            worker.IsActive);

                if (!workerExists)
                {
                    return BadRequest(new
                    {
                        message =
                            "The selected Logistics worker does not exist or is inactive."
                    });
                }
            }

            var sourceRequest =
                await LoadRequestSnapshotAsync(id);

            if (sourceRequest == null)
            {
                return NotFound(new
                {
                    message = "Logistics request not found."
                });
            }

            if (sourceRequest.ConvertedTaskID.HasValue)
            {
                return Conflict(new
                {
                    message =
                        $"Request #{id} has already been converted to Task #{sourceRequest.ConvertedTaskID.Value}."
                });
            }

            if (FinalRequestStatuses.Contains(sourceRequest.Status))
            {
                return BadRequest(new
                {
                    message =
                        $"Request #{id} cannot be converted while its status is {sourceRequest.Status}."
                });
            }

            var now = DateTime.Now;
            var managerNotes = CleanNullable(request.ManagerNotes);

            var task =
                new LogisticsTask
                {
                    DepartmentID =
                        request.DepartmentID,

                    Title =
                        sourceRequest.Title,

                    Background =
                        BuildTaskBackground(sourceRequest),

                    RequestedDate =
                        sourceRequest.CreatedDate.Date,

                    RequestedByUserID =
                        sourceRequest.RequestedByUserID,

                    Priority =
                        NkrnRequestRules.ToLegacyTaskPriority(priority),

                    ResponsibleUserID =
                        null,

                    ResponsibleWorkerID =
                        request.ResponsibleWorkerID,

                    ResponsibleText =
                        null,

                    QuoteRequired =
                        false,

                    QuoteReceived =
                        false,

                    DueDate =
                        request.DueDate?.Date,

                    DueDateNote =
                        null,

                    Status =
                        "In Proses",

                    NextAction =
                        CleanNullable(request.NextAction),

                    ContractorName =
                        null,

                    BudgetAmount =
                        null,

                    ApprovalStatus =
                        "Approved",

                    CompletedDate =
                        null,

                    LastFollowUp =
                        null,

                    NextFollowUp =
                        null,

                    Notes =
                        BuildTaskNotes(
                            sourceRequest.RequestID,
                            managerNotes),

                    IncludeOnJobCard =
                        request.IncludeOnJobCard,

                    IsArchived =
                        false,

                    CreatedDate =
                        now,

                    UpdatedDate =
                        now
                };

            await using var transaction =
                await _context.Database.BeginTransactionAsync();

            try
            {
                _context.LogisticsTasks.Add(task);

                await _context.SaveChangesAsync();

                var affected =
                    await _context.Database.ExecuteSqlInterpolatedAsync($@"
                        UPDATE dbo.LogisticsRequests
                        SET
                            Status = 'Busy',
                            Priority = {priority},
                            ManagerNotes = {managerNotes},
                            ReviewedByUserID = {userID.Value},
                            ReviewedDate = SYSDATETIME(),
                            ConvertedTaskID = {task.TaskID},
                            UpdatedDate = SYSDATETIME()
                        WHERE
                            RequestID = {id}
                            AND IsDeleted = 0
                            AND ConvertedTaskID IS NULL
                            AND Status NOT IN
                            (
                                'Converted',
                                'Completed',
                                'Cancelled',
                                'Declined'
                            );");

                if (affected != 1)
                {
                    await transaction.RollbackAsync();

                    _context.Entry(task).State =
                        EntityState.Detached;

                    return Conflict(new
                    {
                        message =
                            "The request changed while it was being converted. Refresh the Logistics request inbox and try again."
                    });
                }

                await transaction.CommitAsync();
                await transaction.DisposeAsync();
                await _notifications.NotifyByIDAsync(id);

                return Ok(new
                {
                    requestID =
                        id,

                    taskID =
                        task.TaskID,

                    message =
                        $"Request #{id} was converted to Logistics Task #{task.TaskID}."
                });
            }
            catch
            {
                await transaction.RollbackAsync();
                throw;
            }
        }

        private async Task<LogisticsRequestSnapshot?> LoadRequestSnapshotAsync(
            int requestID)
        {
            var connection =
                _context.Database.GetDbConnection();

            var shouldClose =
                connection.State != ConnectionState.Open;

            if (shouldClose)
            {
                await connection.OpenAsync();
            }

            try
            {
                await using var command =
                    connection.CreateCommand();

                command.CommandText = """
                    SELECT
                        R.RequestID,
                        R.RequestedByUserID,
                        R.RequestType,
                        R.ActivityCategory,
                        R.Title,
                        R.Description,
                        R.ActivityDate,
                        R.Status,
                        R.ConvertedTaskID,
                        R.CreatedDate,
                        COALESCE(LocationInfo.LocationDisplay, '') AS LocationDisplay
                    FROM dbo.LogisticsRequests R
                    OUTER APPLY
                    (
                        SELECT TOP (1)
                            COALESCE(
                                L.LocationName,
                                RL.LocationText,
                                ''
                            ) AS LocationDisplay
                        FROM dbo.LogisticsRequestLocations RL
                        LEFT JOIN dbo.Locations L
                            ON L.LocationID = RL.LocationID
                        WHERE RL.RequestID = R.RequestID
                        ORDER BY
                            RL.IsPrimary DESC,
                            RL.RequestLocationID
                    ) LocationInfo
                    WHERE R.RequestID = @RequestID AND R.IsDeleted = 0;
                    """;

                AddParameter(
                    command,
                    "@RequestID",
                    requestID);

                await using var reader =
                    await command.ExecuteReaderAsync();

                if (!await reader.ReadAsync())
                {
                    return null;
                }

                return new LogisticsRequestSnapshot
                {
                    RequestID =
                        reader.GetInt32(0),

                    RequestedByUserID =
                        reader.GetInt32(1),

                    RequestType =
                        reader.GetString(2),

                    ActivityCategory =
                        GetNullableString(reader, 3),

                    Title =
                        reader.GetString(4),

                    Description =
                        GetNullableString(reader, 5),

                    ActivityDate =
                        reader.IsDBNull(6)
                            ? null
                            : reader.GetDateTime(6),

                    Status =
                        reader.GetString(7),

                    ConvertedTaskID =
                        reader.IsDBNull(8)
                            ? null
                            : reader.GetInt32(8),

                    CreatedDate =
                        reader.GetDateTime(9),

                    LocationDisplay =
                        reader.GetString(10)
                };
            }
            finally
            {
                if (shouldClose &&
                    connection.State == ConnectionState.Open)
                {
                    await connection.CloseAsync();
                }
            }
        }

        private async Task<bool> CanManageLogisticsAsync()
        {
            var id = GetLoggedInUserID();
            return id.HasValue && await _context.Users.AnyAsync(u => u.UserID == id.Value && u.IsActive &&
                (u.RoleID == 3 || _context.ModulePermissions.Any(p => p.UserID == id.Value &&
                    p.ModuleKey.ToLower() == "logistics" && p.CanView && (p.CanManage || p.CanAdmin))));
        }

        private int? GetLoggedInUserID()
        {
            var value =
                User.FindFirstValue(
                    ClaimTypes.NameIdentifier);

            return int.TryParse(
                value,
                out var userID)
                    ? userID
                    : null;
        }

        private static string BuildTaskBackground(
            LogisticsRequestSnapshot request)
        {
            var lines =
                new List<string>
                {
                    $"Converted from NKRN Logistics Request #{request.RequestID}.",
                    $"Request type: {request.RequestType}"
                };

            if (!string.IsNullOrWhiteSpace(request.ActivityCategory))
            {
                lines.Add(
                    $"Category: {request.ActivityCategory}");
            }

            if (!string.IsNullOrWhiteSpace(request.LocationDisplay))
            {
                lines.Add(
                    $"Location: {request.LocationDisplay}");
            }

            if (request.ActivityDate.HasValue)
            {
                lines.Add(
                    $"Activity date: {request.ActivityDate.Value:yyyy-MM-dd}");
            }

            if (!string.IsNullOrWhiteSpace(request.Description))
            {
                lines.Add(string.Empty);
                lines.Add(request.Description.Trim());
            }

            return string.Join(
                Environment.NewLine,
                lines);
        }

        private static string BuildTaskNotes(
            int requestID,
            string? managerNotes)
        {
            if (string.IsNullOrWhiteSpace(managerNotes))
            {
                return
                    $"Source: NKRN Logistics Request #{requestID}.";
            }

            return
                $"Source: NKRN Logistics Request #{requestID}.{Environment.NewLine}{Environment.NewLine}Manager notes:{Environment.NewLine}{managerNotes}";
        }

        private static string? CleanNullable(
            string? value)
        {
            return string.IsNullOrWhiteSpace(value)
                ? null
                : value.Trim();
        }

        private static string? GetNullableString(
            DbDataReader reader,
            int ordinal)
        {
            return reader.IsDBNull(ordinal)
                ? null
                : reader.GetString(ordinal);
        }

        private static void AddParameter(
            DbCommand command,
            string name,
            object? value)
        {
            var parameter =
                command.CreateParameter();

            parameter.ParameterName =
                name;

            parameter.Value =
                value ?? DBNull.Value;

            command.Parameters.Add(
                parameter);
        }

        private sealed class LogisticsRequestSnapshot
        {
            public int RequestID { get; set; }
            public int RequestedByUserID { get; set; }

            public string RequestType { get; set; } =
                string.Empty;

            public string? ActivityCategory { get; set; }

            public string Title { get; set; } =
                string.Empty;

            public string? Description { get; set; }

            public DateTime? ActivityDate { get; set; }

            public string Status { get; set; } =
                string.Empty;

            public int? ConvertedTaskID { get; set; }

            public DateTime CreatedDate { get; set; }

            public string LocationDisplay { get; set; } =
                string.Empty;
        }
    }

    public class ConvertLogisticsRequestToTaskRequest
    {
        public int? DepartmentID { get; set; }

        public int? ResponsibleWorkerID { get; set; }

        public string Priority { get; set; } =
            "P3";

        public DateTime? DueDate { get; set; }

        public string? NextAction { get; set; }

        public string? ManagerNotes { get; set; }

        public bool IncludeOnJobCard { get; set; } =
            true;
    }
}
