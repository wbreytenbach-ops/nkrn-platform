using System.Data;
using System.Data.Common;
using System.Security.Claims;
using NKRN.API.Data;
using NKRN.API.Models;
using NKRN.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace NKRN.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class LogisticsRequestsController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        private readonly LogisticsRequestNotificationService _notifications;
        private readonly NkrnAiService _aiService;

        private static readonly HashSet<string> AllowedStatuses =
            new(StringComparer.OrdinalIgnoreCase)
            {
                "Logged",
                "Busy",
                "Done",
                "Cancelled",
                "Declined",

                // Historical values remain readable during the Q4 transition.
                "New",
                "Under Review",
                "Needs Information",
                "Approved",
                "Converted",
                "Completed"
            };

        private static readonly HashSet<string> AllowedMaintenanceActions =
            new(StringComparer.OrdinalIgnoreCase)
            {
                "Repair",
                "Replace",
                "Unsure"
            };

        public LogisticsRequestsController(
            ApplicationDbContext context,
            LogisticsRequestNotificationService notifications,
            NkrnAiService aiService)
        {
            _context = context;
            _notifications = notifications;
            _aiService = aiService;
        }

        // ============================================================
        // GET MY REQUESTS
        // Normal teachers use this endpoint.
        // ============================================================

        [HttpGet("mine")]
        public async Task<ActionResult<IEnumerable<LogisticsRequestResponse>>> GetMyRequests()
        {
            var userID = GetLoggedInUserID();

            if (userID == null)
            {
                return Unauthorized();
            }

            var requests =
                await LoadRequestsAsync(
                    requestedByUserID: userID.Value);

            return Ok(requests);
        }

        // ============================================================
        // GET ALL REQUESTS
        // Logistics management / Admin only.
        // ============================================================

        [HttpGet]
        public async Task<ActionResult<IEnumerable<LogisticsRequestResponse>>> GetAllRequests(
            [FromQuery] string? status = null)
        {
            if (!await CanManageLogisticsAsync())
            {
                return Forbid();
            }

            var requests =
                await LoadRequestsAsync(
                    status: status);

            return Ok(requests);
        }

        // ============================================================
        // GET ONE REQUEST
        // Owner OR Logistics management.
        // ============================================================

        [HttpGet("{id:int}")]
        public async Task<ActionResult<LogisticsRequestResponse>> GetRequest(
            int id)
        {
            var userID = GetLoggedInUserID();

            if (userID == null)
            {
                return Unauthorized();
            }

            var request =
                await LoadRequestByIDAsync(id);

            if (request == null)
            {
                return NotFound();
            }

            if (request.RequestedByUserID != userID.Value &&
                !await CanManageLogisticsAsync())
            {
                return Forbid();
            }

            return Ok(request);
        }

        // ============================================================
        // REFERENCE DATA
        // Used by the teacher request form.
        // ============================================================

        [HttpGet("reference-data")]
        public async Task<IActionResult> GetReferenceData()
        {
            var locations =
                await LoadLocationsAsync();

            var equipment =
                await LoadEquipmentTypesAsync();

            var maintenance =
                await LoadMaintenanceTypesAsync();

            return Ok(new
            {
                locations,
                equipment,
                maintenance,
                requestTypes = new[]
                {
                    "Event",
                    "Maintenance",
                    "General"
                },
                activityCategories = new[]
                {
                    "Sport",
                    "Culture",
                    "Academic",
                    "Meeting",
                    "Function",
                    "Other"
                }
            });
        }

        // ============================================================
        // CREATE REQUEST
        // Any authenticated NKRN user can submit.
        // Requester comes from JWT, never from client input.
        // ============================================================

        [HttpPost]
        public async Task<ActionResult<LogisticsRequestResponse>> CreateRequest(
            [FromBody] CreateLogisticsRequestRequest request)
        {
            var userID = GetLoggedInUserID();

            if (userID == null)
            {
                return Unauthorized();
            }

            var requester =
                await _context.Users
                    .AsNoTracking()
                    .FirstOrDefaultAsync(user =>
                        user.UserID == userID.Value &&
                        user.IsActive);

            if (requester == null)
            {
                return Unauthorized();
            }

            if (request == null)
            {
                return BadRequest(new
                {
                    message = "Request information is required."
                });
            }

            if (string.IsNullOrWhiteSpace(request.RequestType))
            {
                return BadRequest(new
                {
                    message = "A request type is required."
                });
            }

            if (string.IsNullOrWhiteSpace(request.Description))
            {
                return BadRequest(new
                {
                    message = "Beskryf kortliks waarmee Logistics kan help."
                });
            }

            if (request.StartTime.HasValue &&
                request.EndTime.HasValue &&
                request.EndTime.Value <= request.StartTime.Value)
            {
                return BadRequest(new
                {
                    message = "The end time must be after the start time."
                });
            }

            if (request.Equipment.Any(item =>
                    item.Quantity.HasValue &&
                    item.Quantity.Value <= 0))
            {
                return BadRequest(new
                {
                    message = "Equipment quantities must be greater than zero."
                });
            }

            if (request.MaintenanceItems.Any(item =>
                    !AllowedMaintenanceActions.Contains(
                        item.ActionType ?? string.Empty)))
            {
                return BadRequest(new
                {
                    message = "Maintenance action must be Repair, Replace or Unsure."
                });
            }

            var internalTitle =
                BuildRequestTitle(request);

            var aiAnalysis = await _aiService.AnalyseAsync(
                new AiTriageRequest
                {
                    ModuleKey = "Logistics",
                    Description = request.Description.Trim(),
                    AdditionalContext =
                        $"Soort: {request.RequestType}; " +
                        $"Aktiwiteitskategorie: {request.ActivityCategory ?? "Nie gespesifiseer"}; " +
                        $"Datum: {request.ActivityDate?.ToString("yyyy-MM-dd") ?? "Nie gespesifiseer"}; " +
                        $"Toerusting-items: {request.Equipment.Count}; " +
                        $"Instandhoudingsitems: {request.MaintenanceItems.Count}"
                },
                HttpContext.RequestAborted);

            var aiPriority =
                NkrnAiService.NormaliseLogisticsPriority(
                    aiAnalysis.SuggestedPriority);

            var databasePriority = aiPriority;

            var connection =
                _context.Database.GetDbConnection();

            var shouldClose =
                connection.State != ConnectionState.Open;

            if (shouldClose)
            {
                await connection.OpenAsync();
            }

            await using var transaction =
                await connection.BeginTransactionAsync();

            try
            {
                int requestID;

                await using (var command =
                    connection.CreateCommand())
                {
                    command.Transaction = transaction;

                    command.CommandText = """
                        INSERT INTO dbo.LogisticsRequests
                        (
                            RequestedByUserID,
                            RequestType,
                            ActivityCategory,
                            Title,
                            Description,
                            ActivityDate,
                            StartTime,
                            EndTime,
                            CleanupNextDay,
                            Priority,
                            Status,
                            CreatedDate,
                            UpdatedDate
                        )
                        OUTPUT INSERTED.RequestID
                        VALUES
                        (
                            @RequestedByUserID,
                            @RequestType,
                            @ActivityCategory,
                            @Title,
                            @Description,
                            @ActivityDate,
                            @StartTime,
                            @EndTime,
                            @CleanupNextDay,
                            @Priority,
                            'Logged',
                            SYSDATETIME(),
                            SYSDATETIME()
                        );
                        """;

                    AddParameter(
                        command,
                        "@RequestedByUserID",
                        userID.Value);

                    AddParameter(
                        command,
                        "@Priority",
                        databasePriority);

                    AddParameter(
                        command,
                        "@RequestType",
                        request.RequestType.Trim());

                    AddParameter(
                        command,
                        "@ActivityCategory",
                        CleanNullable(request.ActivityCategory));

                    AddParameter(
                        command,
                        "@Title",
                        internalTitle);

                    AddParameter(
                        command,
                        "@Description",
                        CleanNullable(request.Description));

                    AddParameter(
                        command,
                        "@ActivityDate",
                        request.ActivityDate?.Date);

                    AddParameter(
                        command,
                        "@StartTime",
                        request.StartTime);

                    AddParameter(
                        command,
                        "@EndTime",
                        request.EndTime);

                    AddParameter(
                        command,
                        "@CleanupNextDay",
                        request.CleanupNextDay);

                    var result =
                        await command.ExecuteScalarAsync();

                    requestID =
                        Convert.ToInt32(result);
                }

                // ----------------------------------------------------
                // LOCATIONS
                // ----------------------------------------------------

                foreach (var location in request.Locations)
                {
                    if (!location.LocationID.HasValue &&
                        string.IsNullOrWhiteSpace(location.LocationText))
                    {
                        continue;
                    }

                    await using var command =
                        connection.CreateCommand();

                    command.Transaction = transaction;

                    command.CommandText = """
                        INSERT INTO dbo.LogisticsRequestLocations
                        (
                            RequestID,
                            LocationID,
                            LocationText,
                            IsPrimary
                        )
                        VALUES
                        (
                            @RequestID,
                            @LocationID,
                            @LocationText,
                            @IsPrimary
                        );
                        """;

                    AddParameter(
                        command,
                        "@RequestID",
                        requestID);

                    AddParameter(
                        command,
                        "@LocationID",
                        location.LocationID);

                    AddParameter(
                        command,
                        "@LocationText",
                        CleanNullable(location.LocationText));

                    AddParameter(
                        command,
                        "@IsPrimary",
                        location.IsPrimary);

                    await command.ExecuteNonQueryAsync();
                }

                // ----------------------------------------------------
                // EQUIPMENT
                // ----------------------------------------------------

                foreach (var item in request.Equipment)
                {
                    if (item.EquipmentTypeID <= 0)
                    {
                        continue;
                    }

                    await using var command =
                        connection.CreateCommand();

                    command.Transaction = transaction;

                    command.CommandText = """
                        INSERT INTO dbo.LogisticsRequestEquipment
                        (
                            RequestID,
                            EquipmentTypeID,
                            Quantity,
                            Notes
                        )
                        VALUES
                        (
                            @RequestID,
                            @EquipmentTypeID,
                            @Quantity,
                            @Notes
                        );
                        """;

                    AddParameter(
                        command,
                        "@RequestID",
                        requestID);

                    AddParameter(
                        command,
                        "@EquipmentTypeID",
                        item.EquipmentTypeID);

                    AddParameter(
                        command,
                        "@Quantity",
                        item.Quantity);

                    AddParameter(
                        command,
                        "@Notes",
                        CleanNullable(item.Notes));

                    await command.ExecuteNonQueryAsync();
                }

                // ----------------------------------------------------
                // MAINTENANCE ITEMS
                // ----------------------------------------------------

                foreach (var item in request.MaintenanceItems)
                {
                    if (item.MaintenanceTypeID <= 0)
                    {
                        continue;
                    }

                    await using var command =
                        connection.CreateCommand();

                    command.Transaction = transaction;

                    command.CommandText = """
                        INSERT INTO dbo.LogisticsRequestMaintenanceItems
                        (
                            RequestID,
                            MaintenanceTypeID,
                            ActionType,
                            Notes
                        )
                        VALUES
                        (
                            @RequestID,
                            @MaintenanceTypeID,
                            @ActionType,
                            @Notes
                        );
                        """;

                    AddParameter(
                        command,
                        "@RequestID",
                        requestID);

                    AddParameter(
                        command,
                        "@MaintenanceTypeID",
                        item.MaintenanceTypeID);

                    AddParameter(
                        command,
                        "@ActionType",
                        NormaliseMaintenanceAction(
                            item.ActionType));

                    AddParameter(
                        command,
                        "@Notes",
                        CleanNullable(item.Notes));

                    await command.ExecuteNonQueryAsync();
                }

                await transaction.CommitAsync();

                var created =
                    await LoadRequestByIDAsync(
                        requestID);

                if (created == null)
                {
                    return StatusCode(
                        500,
                        new
                        {
                            message =
                                "The request was saved but could not be reloaded."
                        });
                }

                await _aiService.TryStoreAnalysisAsync(
                    "Logistics",
                    created.RequestID,
                    aiAnalysis,
                    HttpContext.RequestAborted);
                if (request.AiSessionID.HasValue)
                {
                    await _aiService.TryCompleteHelpSessionAsync(
                        userID.Value,
                        request.AiSessionID.Value,
                        "RequestLogged",
                        created.RequestID,
                        cancellationToken: HttpContext.RequestAborted);
                }

                await _notifications.NotifyAsync(created, created: true);

                return CreatedAtAction(
                    nameof(GetRequest),
                    new
                    {
                        id = created.RequestID
                    },
                    created);
            }
            catch
            {
                await transaction.RollbackAsync();
                throw;
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

        // ============================================================
        // UPDATE REQUEST STATUS / MANAGER NOTES
        // ============================================================

        [HttpDelete("{id:int}")]
        public async Task<IActionResult> DeleteRequest(int id)
        {
            var userID = GetLoggedInUserID();
            if (userID == null) return Unauthorized();
            if (!await _context.Users.AnyAsync(u => u.UserID == userID && u.IsActive && u.RoleID == 3)) return Forbid();
            var affected = await _context.Database.ExecuteSqlInterpolatedAsync($"""
                UPDATE dbo.LogisticsRequests SET IsDeleted = 1, DeletedByUserID = {userID.Value},
                    DeletedAt = SYSUTCDATETIME(), UpdatedDate = SYSDATETIME()
                WHERE RequestID = {id} AND IsDeleted = 0;
                """);
            return affected == 0 ? NotFound() : NoContent();
        }

        [HttpPost("bulk-delete")]
        public async Task<IActionResult> DeleteRequests([FromBody] int[] requestIDs)
        {
            var userID = GetLoggedInUserID();
            if (userID == null) return Unauthorized();

            var isAdmin = await _context.Users.AnyAsync(
                u => u.UserID == userID.Value && u.IsActive && u.RoleID == 3);
            if (!isAdmin) return Forbid();

            if (requestIDs == null || requestIDs.Length == 0)
            {
                return BadRequest(new { message = "Select at least one request to delete." });
            }

            var ids = requestIDs.Distinct().ToArray();
            if (ids.Length > 250 || ids.Any(id => id <= 0))
            {
                return BadRequest(new { message = "The selected request list is invalid." });
            }

            var deletedIDs = new List<int>();
            var notFoundIDs = new List<int>();

            await using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                foreach (var requestID in ids)
                {
                    var affected = await _context.Database.ExecuteSqlInterpolatedAsync($"""
                        UPDATE dbo.LogisticsRequests
                        SET IsDeleted = 1,
                            DeletedByUserID = {userID.Value},
                            DeletedAt = SYSUTCDATETIME(),
                            UpdatedDate = SYSDATETIME()
                        WHERE RequestID = {requestID}
                          AND IsDeleted = 0;
                        """);

                    if (affected > 0)
                        deletedIDs.Add(requestID);
                    else
                        notFoundIDs.Add(requestID);
                }

                await transaction.CommitAsync();
            }
            catch
            {
                await transaction.RollbackAsync();
                throw;
            }

            return Ok(new
            {
                deletedCount = deletedIDs.Count,
                deletedRequestIDs = deletedIDs,
                notFoundRequestIDs = notFoundIDs
            });
        }

        [HttpPut("{id:int}/status")]
        public async Task<IActionResult> UpdateStatus(
            int id,
            [FromBody] UpdateLogisticsRequestStatusRequest update)
        {
            if (!await CanManageLogisticsAsync())
            {
                return Forbid();
            }

            if (update == null ||
                string.IsNullOrWhiteSpace(update.Status))
            {
                return BadRequest(new
                {
                    message = "A status is required."
                });
            }

            if (!AllowedStatuses.Contains(update.Status))
            {
                return BadRequest(new
                {
                    message = "Invalid Logistics request status."
                });
            }

            if (update.Priority != null && !new[] { "Low", "Medium", "High", "Critical" }.Contains(update.Priority, StringComparer.OrdinalIgnoreCase))
                return BadRequest(new { message = "Prioriteit moet Low, Medium, High of Critical wees." });

            var userID = GetLoggedInUserID();

            if (userID == null)
            {
                return Unauthorized();
            }

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
                await using var transaction = await connection.BeginTransactionAsync();
                await using var command = connection.CreateCommand();
                command.Transaction = transaction;

                command.CommandText = """
                    UPDATE dbo.LogisticsRequests
                    SET
                        Status = @Status,
                        Priority = COALESCE(@Priority, Priority),
                        ManagerNotes = @ManagerNotes,
                        ReviewedByUserID = @ReviewedByUserID,
                        ReviewedDate = SYSDATETIME(),
                        UpdatedDate = SYSDATETIME()
                    OUTPUT deleted.Status
                    WHERE RequestID = @RequestID AND IsDeleted = 0;
                    """;

                AddParameter(
                    command,
                    "@Priority",
                    string.IsNullOrWhiteSpace(update.Priority)
                        ? null
                        : NkrnRequestRules.NormalisePriority(update.Priority));
                AddParameter(
                    command,
                    "@Status",
                    CanonicalStatus(update.Status));

                AddParameter(
                    command,
                    "@ManagerNotes",
                    CleanNullable(update.ManagerNotes));

                AddParameter(
                    command,
                    "@ReviewedByUserID",
                    userID.Value);

                AddParameter(
                    command,
                    "@RequestID",
                    id);

                var previousStatus = await command.ExecuteScalarAsync();

                if (previousStatus == null)
                {
                    return NotFound();
                }

                await using var taskCommand = connection.CreateCommand();
                taskCommand.Transaction = transaction;
                taskCommand.CommandText = """
                    UPDATE T SET Status = CASE @status WHEN 'Done' THEN 'Afgehandel' WHEN 'Logged' THEN 'Nog nie begin' WHEN 'Cancelled' THEN 'Cancelled' WHEN 'Declined' THEN 'Cancelled' ELSE 'In Proses' END,
                        Priority = CASE R.Priority WHEN 'Critical' THEN 'P1' WHEN 'High' THEN 'P2' WHEN 'Low' THEN 'P4' ELSE 'P3' END,
                        CompletedDate = CASE WHEN @status = 'Done' THEN COALESCE(T.CompletedDate, SYSDATETIME()) ELSE NULL END,
                        UpdatedDate = SYSDATETIME()
                    FROM dbo.LogisticsTasks T JOIN dbo.LogisticsRequests R ON R.ConvertedTaskID = T.TaskID
                    WHERE R.RequestID = @id AND R.IsDeleted = 0;
                    """;
                AddParameter(taskCommand, "@status", CanonicalStatus(update.Status));
                AddParameter(taskCommand, "@id", id);
                await taskCommand.ExecuteNonQueryAsync();
                await transaction.CommitAsync();
                await transaction.DisposeAsync();
                if (!string.Equals(Convert.ToString(previousStatus), CanonicalStatus(update.Status), StringComparison.OrdinalIgnoreCase))
                    await _notifications.NotifyByIDAsync(id);
                return NoContent();
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

        // ============================================================
        // CANCEL OWN REQUEST
        // Teachers can cancel before conversion/completion.
        // ============================================================

        [HttpPost("{id:int}/cancel")]
        public async Task<IActionResult> CancelOwnRequest(
            int id)
        {
            var userID = GetLoggedInUserID();

            if (userID == null)
            {
                return Unauthorized();
            }

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
                    UPDATE dbo.LogisticsRequests
                    SET
                        Status = 'Cancelled',
                        UpdatedDate = SYSDATETIME()
                    WHERE
                        RequestID = @RequestID
                        AND IsDeleted = 0
                        AND RequestedByUserID = @UserID
                        AND ConvertedTaskID IS NULL
                        AND Status NOT IN ('Converted', 'Completed', 'Cancelled');
                    """;

                AddParameter(
                    command,
                    "@RequestID",
                    id);

                AddParameter(
                    command,
                    "@UserID",
                    userID.Value);

                var affected =
                    await command.ExecuteNonQueryAsync();

                if (affected == 0)
                {
                    return BadRequest(new
                    {
                        message =
                            "This request cannot be cancelled."
                    });
                }

                await _notifications.NotifyByIDAsync(id);
                return NoContent();
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

        // ============================================================
        // LOAD REQUESTS
        // ============================================================

        private async Task<List<LogisticsRequestResponse>> LoadRequestsAsync(
            int? requestedByUserID = null,
            string? status = null)
        {
            var output =
                new List<LogisticsRequestResponse>();

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
                        COALESCE(U.FirstName, '') AS FirstName,
                        COALESCE(U.LastName, '') AS LastName,
                        COALESCE(U.Email, '') AS Email,
                        R.RequestType,
                        R.ActivityCategory,
                        R.Title,
                        R.Description,
                        R.ActivityDate,
                        R.StartTime,
                        R.EndTime,
                        R.CleanupNextDay,
                        R.Priority,
                        R.Status,
                        R.ManagerNotes,
                        R.ReviewedByUserID,
                        R.ReviewedDate,
                        R.ConvertedTaskID,
                        R.CreatedDate,
                        R.UpdatedDate
                    FROM dbo.LogisticsRequests R
                    LEFT JOIN dbo.Users U
                        ON U.UserID = R.RequestedByUserID
                    WHERE
                        R.IsDeleted = 0 AND (@RequestedByUserID IS NULL
                            OR R.RequestedByUserID = @RequestedByUserID)
                        AND
                        (@Status IS NULL
                            OR R.Status = @Status)
                    ORDER BY
                        R.CreatedDate DESC,
                        R.RequestID DESC;
                    """;

                AddParameter(
                    command,
                    "@RequestedByUserID",
                    requestedByUserID);

                AddParameter(
                    command,
                    "@Status",
                    CleanNullable(status));

                await using var reader =
                    await command.ExecuteReaderAsync();

                while (await reader.ReadAsync())
                {
                    output.Add(
                        MapRequest(reader));
                }
            }
            finally
            {
                if (shouldClose &&
                    connection.State == ConnectionState.Open)
                {
                    await connection.CloseAsync();
                }
            }

            return output;
        }

        private async Task<LogisticsRequestResponse?> LoadRequestByIDAsync(
            int requestID)
        {
            LogisticsRequestResponse? output = null;

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
                // ----------------------------------------------------
                // HEADER
                // ----------------------------------------------------

                await using (var command =
                    connection.CreateCommand())
                {
                    command.CommandText = """
                        SELECT
                            R.RequestID,
                            R.RequestedByUserID,
                            COALESCE(U.FirstName, '') AS FirstName,
                            COALESCE(U.LastName, '') AS LastName,
                            COALESCE(U.Email, '') AS Email,
                            R.RequestType,
                            R.ActivityCategory,
                            R.Title,
                            R.Description,
                            R.ActivityDate,
                            R.StartTime,
                            R.EndTime,
                            R.CleanupNextDay,
                            R.Priority,
                            R.Status,
                            R.ManagerNotes,
                            R.ReviewedByUserID,
                            R.ReviewedDate,
                            R.ConvertedTaskID,
                            R.CreatedDate,
                            R.UpdatedDate
                        FROM dbo.LogisticsRequests R
                        LEFT JOIN dbo.Users U
                            ON U.UserID = R.RequestedByUserID
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

                    output =
                        MapRequest(reader);
                }

                // ----------------------------------------------------
                // LOCATIONS
                // ----------------------------------------------------

                await using (var command =
                    connection.CreateCommand())
                {
                    command.CommandText = """
                        SELECT
                            RL.RequestLocationID,
                            RL.RequestID,
                            RL.LocationID,
                            L.LocationName,
                            L.LocationCode,
                            L.LocationType,
                            RL.LocationText,
                            RL.IsPrimary
                        FROM dbo.LogisticsRequestLocations RL
                        LEFT JOIN dbo.Locations L
                            ON L.LocationID = RL.LocationID
                        WHERE RL.RequestID = @RequestID
                        ORDER BY
                            RL.IsPrimary DESC,
                            RL.RequestLocationID;
                        """;

                    AddParameter(
                        command,
                        "@RequestID",
                        requestID);

                    await using var reader =
                        await command.ExecuteReaderAsync();

                    while (await reader.ReadAsync())
                    {
                        output.Locations.Add(
                            new LogisticsRequestLocationResponse
                            {
                                RequestLocationID =
                                    reader.GetInt32(0),

                                RequestID =
                                    reader.GetInt32(1),

                                LocationID =
                                    reader.IsDBNull(2)
                                        ? null
                                        : reader.GetInt32(2),

                                LocationName =
                                    GetNullableString(
                                        reader,
                                        3),

                                LocationCode =
                                    GetNullableString(
                                        reader,
                                        4),

                                LocationType =
                                    GetNullableString(
                                        reader,
                                        5),

                                LocationText =
                                    GetNullableString(
                                        reader,
                                        6),

                                IsPrimary =
                                    reader.GetBoolean(7)
                            });
                    }
                }

                // ----------------------------------------------------
                // EQUIPMENT
                // ----------------------------------------------------

                await using (var command =
                    connection.CreateCommand())
                {
                    command.CommandText = """
                        SELECT
                            RE.RequestEquipmentID,
                            RE.RequestID,
                            RE.EquipmentTypeID,
                            ET.EquipmentName,
                            RE.Quantity,
                            RE.Notes
                        FROM dbo.LogisticsRequestEquipment RE
                        INNER JOIN dbo.LogisticsEquipmentTypes ET
                            ON ET.EquipmentTypeID = RE.EquipmentTypeID
                        WHERE RE.RequestID = @RequestID
                        ORDER BY
                            ET.DisplayOrder,
                            ET.EquipmentName;
                        """;

                    AddParameter(
                        command,
                        "@RequestID",
                        requestID);

                    await using var reader =
                        await command.ExecuteReaderAsync();

                    while (await reader.ReadAsync())
                    {
                        output.Equipment.Add(
                            new LogisticsRequestEquipmentResponse
                            {
                                RequestEquipmentID =
                                    reader.GetInt32(0),

                                RequestID =
                                    reader.GetInt32(1),

                                EquipmentTypeID =
                                    reader.GetInt32(2),

                                EquipmentName =
                                    reader.GetString(3),

                                Quantity =
                                    reader.IsDBNull(4)
                                        ? null
                                        : reader.GetInt32(4),

                                Notes =
                                    GetNullableString(
                                        reader,
                                        5)
                            });
                    }
                }

                // ----------------------------------------------------
                // MAINTENANCE
                // ----------------------------------------------------

                await using (var command =
                    connection.CreateCommand())
                {
                    command.CommandText = """
                        SELECT
                            RM.RequestMaintenanceItemID,
                            RM.RequestID,
                            RM.MaintenanceTypeID,
                            MT.MaintenanceName,
                            RM.ActionType,
                            RM.Notes
                        FROM dbo.LogisticsRequestMaintenanceItems RM
                        INNER JOIN dbo.LogisticsMaintenanceTypes MT
                            ON MT.MaintenanceTypeID = RM.MaintenanceTypeID
                        WHERE RM.RequestID = @RequestID
                        ORDER BY
                            MT.DisplayOrder,
                            MT.MaintenanceName;
                        """;

                    AddParameter(
                        command,
                        "@RequestID",
                        requestID);

                    await using var reader =
                        await command.ExecuteReaderAsync();

                    while (await reader.ReadAsync())
                    {
                        output.MaintenanceItems.Add(
                            new LogisticsRequestMaintenanceItemResponse
                            {
                                RequestMaintenanceItemID =
                                    reader.GetInt32(0),

                                RequestID =
                                    reader.GetInt32(1),

                                MaintenanceTypeID =
                                    reader.GetInt32(2),

                                MaintenanceName =
                                    reader.GetString(3),

                                ActionType =
                                    reader.GetString(4),

                                Notes =
                                    GetNullableString(
                                        reader,
                                        5)
                            });
                    }
                }

                return output;
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

        private static LogisticsRequestResponse MapRequest(
            DbDataReader reader)
        {
            var firstName =
                reader.GetString(2);

            var lastName =
                reader.GetString(3);

            return new LogisticsRequestResponse
            {
                RequestID =
                    reader.GetInt32(0),

                RequestedByUserID =
                    reader.GetInt32(1),

                RequestedByName =
                    $"{firstName} {lastName}".Trim(),

                RequestedByEmail =
                    reader.GetString(4),

                RequestType =
                    reader.GetString(5),

                ActivityCategory =
                    GetNullableString(
                        reader,
                        6),

                Title =
                    reader.GetString(7),

                Description =
                    GetNullableString(
                        reader,
                        8),

                ActivityDate =
                    reader.IsDBNull(9)
                        ? null
                        : reader.GetDateTime(9),

                StartTime =
                    reader.IsDBNull(10)
                        ? null
                        : reader.GetFieldValue<TimeSpan>(10),

                EndTime =
                    reader.IsDBNull(11)
                        ? null
                        : reader.GetFieldValue<TimeSpan>(11),

                CleanupNextDay =
                    reader.IsDBNull(12)
                        ? null
                        : reader.GetBoolean(12),

                Priority =
                    reader.GetString(13),

                Status =
                    reader.GetString(14),

                ManagerNotes =
                    GetNullableString(
                        reader,
                        15),

                ReviewedByUserID =
                    reader.IsDBNull(16)
                        ? null
                        : reader.GetInt32(16),

                ReviewedDate =
                    reader.IsDBNull(17)
                        ? null
                        : reader.GetDateTime(17),

                ConvertedTaskID =
                    reader.IsDBNull(18)
                        ? null
                        : reader.GetInt32(18),

                CreatedDate =
                    reader.GetDateTime(19),

                UpdatedDate =
                    reader.GetDateTime(20)
            };
        }

        // ============================================================
        // REFERENCE LOADERS
        // ============================================================

        private async Task<List<LocationResponse>> LoadLocationsAsync()
        {
            var output =
                new List<LocationResponse>();

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
                        LocationID,
                        LocationName,
                        LocationCode,
                        LocationType,
                        Building,
                        FloorName,
                        MapShapeKey,
                        CanBeBooked,
                        IsActive,
                        DisplayOrder
                    FROM dbo.Locations
                    WHERE IsActive = 1
                    ORDER BY
                        DisplayOrder,
                        LocationName;
                    """;

                await using var reader =
                    await command.ExecuteReaderAsync();

                while (await reader.ReadAsync())
                {
                    output.Add(
                        new LocationResponse
                        {
                            LocationID =
                                reader.GetInt32(0),

                            LocationName =
                                reader.GetString(1),

                            LocationCode =
                                GetNullableString(
                                    reader,
                                    2),

                            LocationType =
                                reader.GetString(3),

                            Building =
                                GetNullableString(
                                    reader,
                                    4),

                            FloorName =
                                GetNullableString(
                                    reader,
                                    5),

                            MapShapeKey =
                                GetNullableString(
                                    reader,
                                    6),

                            CanBeBooked =
                                reader.GetBoolean(7),

                            IsActive =
                                reader.GetBoolean(8),

                            DisplayOrder =
                                reader.GetInt32(9)
                        });
                }

                return output;
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

        private async Task<List<EquipmentTypeResponse>> LoadEquipmentTypesAsync()
        {
            var output =
                new List<EquipmentTypeResponse>();

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
                        EquipmentTypeID,
                        EquipmentName,
                        IsActive,
                        DisplayOrder
                    FROM dbo.LogisticsEquipmentTypes
                    WHERE IsActive = 1
                    ORDER BY
                        DisplayOrder,
                        EquipmentName;
                    """;

                await using var reader =
                    await command.ExecuteReaderAsync();

                while (await reader.ReadAsync())
                {
                    output.Add(
                        new EquipmentTypeResponse
                        {
                            EquipmentTypeID =
                                reader.GetInt32(0),

                            EquipmentName =
                                reader.GetString(1),

                            IsActive =
                                reader.GetBoolean(2),

                            DisplayOrder =
                                reader.GetInt32(3)
                        });
                }

                return output;
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

        private async Task<List<MaintenanceTypeResponse>> LoadMaintenanceTypesAsync()
        {
            var output =
                new List<MaintenanceTypeResponse>();

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
                        MaintenanceTypeID,
                        MaintenanceName,
                        IsActive,
                        DisplayOrder
                    FROM dbo.LogisticsMaintenanceTypes
                    WHERE IsActive = 1
                    ORDER BY
                        DisplayOrder,
                        MaintenanceName;
                    """;

                await using var reader =
                    await command.ExecuteReaderAsync();

                while (await reader.ReadAsync())
                {
                    output.Add(
                        new MaintenanceTypeResponse
                        {
                            MaintenanceTypeID =
                                reader.GetInt32(0),

                            MaintenanceName =
                                reader.GetString(1),

                            IsActive =
                                reader.GetBoolean(2),

                            DisplayOrder =
                                reader.GetInt32(3)
                        });
                }

                return output;
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

        // ============================================================
        // MINIMUM-INPUT INTERNAL TITLE
        // ============================================================

        private static string BuildRequestTitle(
            CreateLogisticsRequestRequest request)
        {
            var typeLabel =
                request.RequestType?.Trim() switch
                {
                    "Event" => "Funksie / Aktiwiteit",
                    "Maintenance" => "Instandhouding",
                    "General" => "Algemeen",
                    _ => "Logistics"
                };

            var description =
                CleanNullable(request.Description)
                ?? "Logistics-versoek";

            description =
                description
                    .Replace("\r", " ")
                    .Replace("\n", " ")
                    .Trim();

            while (description.Contains("  "))
            {
                description =
                    description.Replace("  ", " ");
            }

            var prefix =
                request.RequestType?.Trim() == "Event" &&
                !string.IsNullOrWhiteSpace(
                    request.ActivityCategory)
                    ? $"{typeLabel} – {request.ActivityCategory.Trim()}"
                    : typeLabel;

            var title =
                $"{prefix} – {description}";

            return title.Length <= 200
                ? title
                : title[..200];
        }

        // ============================================================
        // NEW REQUEST NOTIFICATION
        //
        // Uses existing Logistics module permissions.
        // Request persistence is never rolled back because email fails.
        // ============================================================

        // ============================================================
        // LOGISTICS PERMISSION
        // Role 3 remains the existing NKRN admin bypass.
        // ============================================================

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

        // ============================================================
        // HELPERS
        // ============================================================

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

        private static string? CleanNullable(
            string? value)
        {
            if (string.IsNullOrWhiteSpace(value))
            {
                return null;
            }

            return value.Trim();
        }

        private static string? GetNullableString(
            DbDataReader reader,
            int ordinal)
        {
            return reader.IsDBNull(ordinal)
                ? null
                : reader.GetString(ordinal);
        }

        private static string NormaliseMaintenanceAction(
            string value)
        {
            if (value.Equals(
                "Repair",
                StringComparison.OrdinalIgnoreCase))
            {
                return "Repair";
            }

            if (value.Equals(
                "Replace",
                StringComparison.OrdinalIgnoreCase))
            {
                return "Replace";
            }

            return "Unsure";
        }

        private static string CanonicalStatus(
            string status)
        {
            return NkrnRequestRules.NormaliseRequestStatus(status);
        }
    }
}
