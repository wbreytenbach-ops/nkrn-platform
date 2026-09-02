using System.Data;
using System.Data.Common;
using System.Security.Claims;
using NKRN.API.Data;
using NKRN.API.Models;
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

        private static readonly HashSet<string> AllowedStatuses =
            new(StringComparer.OrdinalIgnoreCase)
            {
                "New",
                "Under Review",
                "Needs Information",
                "Approved",
                "Declined",
                "Converted",
                "Completed",
                "Cancelled"
            };

        private static readonly HashSet<string> AllowedMaintenanceActions =
            new(StringComparer.OrdinalIgnoreCase)
            {
                "Repair",
                "Replace",
                "Unsure"
            };

        public LogisticsRequestsController(
            ApplicationDbContext context)
        {
            _context = context;
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

            if (string.IsNullOrWhiteSpace(request.Title))
            {
                return BadRequest(new
                {
                    message = "A request title is required."
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
                            'P3',
                            'New',
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
                        "@RequestType",
                        request.RequestType.Trim());

                    AddParameter(
                        command,
                        "@ActivityCategory",
                        CleanNullable(request.ActivityCategory));

                    AddParameter(
                        command,
                        "@Title",
                        request.Title.Trim());

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
                        Status = @Status,
                        ManagerNotes = @ManagerNotes,
                        ReviewedByUserID = @ReviewedByUserID,
                        ReviewedDate = SYSDATETIME(),
                        UpdatedDate = SYSDATETIME()
                    WHERE RequestID = @RequestID;
                    """;

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

                var affected =
                    await command.ExecuteNonQueryAsync();

                if (affected == 0)
                {
                    return NotFound();
                }

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
                        AND RequestedByUserID = @UserID
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
                        (@RequestedByUserID IS NULL
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
                        WHERE R.RequestID = @RequestID;
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
        // LOGISTICS PERMISSION
        // Role 3 remains the existing NKRN admin bypass.
        // ============================================================

        private async Task<bool> CanManageLogisticsAsync()
        {
            if (User.IsInRole("3"))
            {
                return true;
            }

            var userID =
                GetLoggedInUserID();

            if (userID == null)
            {
                return false;
            }

            return await _context.ModulePermissions
                .AnyAsync(permission =>
                    permission.UserID == userID.Value &&
                    permission.ModuleKey == "Logistics" &&
                    permission.CanView &&
                    permission.CanManage);
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
            return AllowedStatuses
                .First(value =>
                    value.Equals(
                        status,
                        StringComparison.OrdinalIgnoreCase));
        }
    }
}
