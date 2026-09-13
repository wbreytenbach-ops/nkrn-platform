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
    public class VenueBookingsController : ControllerBase
    {
        private readonly ApplicationDbContext _context;

        public VenueBookingsController(
            ApplicationDbContext context)
        {
            _context = context;
        }

        // ============================================================
        // VIEW BOOKINGS
        // All authenticated staff may view venue occupancy.
        // ============================================================

        [HttpGet]
        public async Task<ActionResult<IEnumerable<VenueBookingResponse>>> GetBookings(
            [FromQuery] DateTime? fromDate = null,
            [FromQuery] DateTime? toDate = null,
            [FromQuery] int? locationID = null)
        {
            var from =
                (fromDate ?? DateTime.Today).Date;

            var to =
                (toDate ?? DateTime.Today.AddMonths(3)).Date;

            if (to < from)
            {
                return BadRequest(new
                {
                    message =
                        "The end date cannot be before the start date."
                });
            }

            var output =
                new List<VenueBookingResponse>();

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
                        B.BookingID,
                        B.LocationID,
                        L.LocationName,
                        B.LogisticsRequestID,
                        B.BookedByUserID,
                        COALESCE(U.FirstName, '') AS FirstName,
                        COALESCE(U.LastName, '') AS LastName,
                        B.Title,
                        B.BookingDate,
                        B.StartTime,
                        B.EndTime,
                        B.Status,
                        B.Notes,
                        B.CreatedDate,
                        B.UpdatedDate
                    FROM dbo.VenueBookings B
                    INNER JOIN dbo.Locations L
                        ON L.LocationID = B.LocationID
                    LEFT JOIN dbo.Users U
                        ON U.UserID = B.BookedByUserID
                    WHERE
                        B.BookingDate >= @FromDate
                        AND B.BookingDate <= @ToDate
                        AND
                        (@LocationID IS NULL
                            OR B.LocationID = @LocationID)
                        AND B.Status <> 'Cancelled'
                    ORDER BY
                        B.BookingDate,
                        B.StartTime,
                        L.LocationName;
                    """;

                AddParameter(
                    command,
                    "@FromDate",
                    from);

                AddParameter(
                    command,
                    "@ToDate",
                    to);

                AddParameter(
                    command,
                    "@LocationID",
                    locationID);

                await using var reader =
                    await command.ExecuteReaderAsync();

                while (await reader.ReadAsync())
                {
                    output.Add(
                        MapBooking(reader));
                }

                return Ok(output);
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
        // CREATE BOOKING
        // Logistics management / Admin only.
        // Teachers request venues via LogisticsRequests.
        // ============================================================

        [HttpPost]
        public async Task<ActionResult<VenueBookingResponse>> CreateBooking(
            [FromBody] CreateVenueBookingRequest request)
        {
            if (!await CanManageLogisticsAsync())
            {
                return Forbid();
            }

            var userID =
                GetLoggedInUserID();

            if (userID == null)
            {
                return Unauthorized();
            }

            if (request == null ||
                request.LocationID <= 0 ||
                string.IsNullOrWhiteSpace(request.Title))
            {
                return BadRequest(new
                {
                    message =
                        "Location and booking title are required."
                });
            }

            if (request.EndTime <= request.StartTime)
            {
                return BadRequest(new
                {
                    message =
                        "End time must be after start time."
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

            try
            {
                // ----------------------------------------------------
                // CHECK LOCATION IS BOOKABLE
                // ----------------------------------------------------

                await using (var command =
                    connection.CreateCommand())
                {
                    command.CommandText = """
                        SELECT COUNT(1)
                        FROM dbo.Locations
                        WHERE
                            LocationID = @LocationID
                            AND IsActive = 1
                            AND CanBeBooked = 1;
                        """;

                    AddParameter(
                        command,
                        "@LocationID",
                        request.LocationID);

                    var count =
                        Convert.ToInt32(
                            await command.ExecuteScalarAsync());

                    if (count == 0)
                    {
                        return BadRequest(new
                        {
                            message =
                                "The selected location is not available for booking."
                        });
                    }
                }

                // ----------------------------------------------------
                // CHECK CONFLICT
                // ----------------------------------------------------

                await using (var command =
                    connection.CreateCommand())
                {
                    command.CommandText = """
                        SELECT COUNT(1)
                        FROM dbo.VenueBookings
                        WHERE
                            LocationID = @LocationID
                            AND BookingDate = @BookingDate
                            AND Status IN ('Pending', 'Confirmed')
                            AND StartTime < @EndTime
                            AND EndTime > @StartTime;
                        """;

                    AddParameter(
                        command,
                        "@LocationID",
                        request.LocationID);

                    AddParameter(
                        command,
                        "@BookingDate",
                        request.BookingDate.Date);

                    AddParameter(
                        command,
                        "@StartTime",
                        request.StartTime);

                    AddParameter(
                        command,
                        "@EndTime",
                        request.EndTime);

                    var conflictCount =
                        Convert.ToInt32(
                            await command.ExecuteScalarAsync());

                    if (conflictCount > 0)
                    {
                        return Conflict(new
                        {
                            message =
                                "The selected venue is already booked during this time."
                        });
                    }
                }

                // ----------------------------------------------------
                // CREATE
                // ----------------------------------------------------

                int bookingID;

                await using (var command =
                    connection.CreateCommand())
                {
                    command.CommandText = """
                        INSERT INTO dbo.VenueBookings
                        (
                            LocationID,
                            LogisticsRequestID,
                            BookedByUserID,
                            Title,
                            BookingDate,
                            StartTime,
                            EndTime,
                            Status,
                            Notes,
                            CreatedDate,
                            UpdatedDate
                        )
                        OUTPUT INSERTED.BookingID
                        VALUES
                        (
                            @LocationID,
                            @LogisticsRequestID,
                            @BookedByUserID,
                            @Title,
                            @BookingDate,
                            @StartTime,
                            @EndTime,
                            'Confirmed',
                            @Notes,
                            SYSDATETIME(),
                            SYSDATETIME()
                        );
                        """;

                    AddParameter(
                        command,
                        "@LocationID",
                        request.LocationID);

                    AddParameter(
                        command,
                        "@LogisticsRequestID",
                        request.LogisticsRequestID);

                    AddParameter(
                        command,
                        "@BookedByUserID",
                        userID.Value);

                    AddParameter(
                        command,
                        "@Title",
                        request.Title.Trim());

                    AddParameter(
                        command,
                        "@BookingDate",
                        request.BookingDate.Date);

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
                        "@Notes",
                        CleanNullable(
                            request.Notes));

                    bookingID =
                        Convert.ToInt32(
                            await command.ExecuteScalarAsync());
                }

                var booking =
                    await LoadBookingAsync(
                        bookingID,
                        connection);

                if (booking == null)
                {
                    return StatusCode(
                        500,
                        new
                        {
                            message =
                                "The booking was created but could not be reloaded."
                        });
                }

                return CreatedAtAction(
                    nameof(GetBookings),
                    new
                    {
                        locationID = booking.LocationID
                    },
                    booking);
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
        // CANCEL BOOKING
        // ============================================================

        [HttpPost("{id:int}/cancel")]
        public async Task<IActionResult> CancelBooking(
            int id)
        {
            if (!await CanManageLogisticsAsync())
            {
                return Forbid();
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
                    UPDATE dbo.VenueBookings
                    SET
                        Status = 'Cancelled',
                        UpdatedDate = SYSDATETIME()
                    WHERE
                        BookingID = @BookingID
                        AND Status <> 'Cancelled';
                    """;

                AddParameter(
                    command,
                    "@BookingID",
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

        private async Task<VenueBookingResponse?> LoadBookingAsync(
            int bookingID,
            DbConnection connection)
        {
            await using var command =
                connection.CreateCommand();

            command.CommandText = """
                SELECT
                    B.BookingID,
                    B.LocationID,
                    L.LocationName,
                    B.LogisticsRequestID,
                    B.BookedByUserID,
                    COALESCE(U.FirstName, '') AS FirstName,
                    COALESCE(U.LastName, '') AS LastName,
                    B.Title,
                    B.BookingDate,
                    B.StartTime,
                    B.EndTime,
                    B.Status,
                    B.Notes,
                    B.CreatedDate,
                    B.UpdatedDate
                FROM dbo.VenueBookings B
                INNER JOIN dbo.Locations L
                    ON L.LocationID = B.LocationID
                LEFT JOIN dbo.Users U
                    ON U.UserID = B.BookedByUserID
                WHERE B.BookingID = @BookingID;
                """;

            AddParameter(
                command,
                "@BookingID",
                bookingID);

            await using var reader =
                await command.ExecuteReaderAsync();

            if (!await reader.ReadAsync())
            {
                return null;
            }

            return MapBooking(reader);
        }

        private static VenueBookingResponse MapBooking(
            DbDataReader reader)
        {
            var firstName =
                reader.GetString(5);

            var lastName =
                reader.GetString(6);

            return new VenueBookingResponse
            {
                BookingID =
                    reader.GetInt32(0),

                LocationID =
                    reader.GetInt32(1),

                LocationName =
                    reader.GetString(2),

                LogisticsRequestID =
                    reader.IsDBNull(3)
                        ? null
                        : reader.GetInt32(3),

                BookedByUserID =
                    reader.GetInt32(4),

                BookedByName =
                    $"{firstName} {lastName}".Trim(),

                Title =
                    reader.GetString(7),

                BookingDate =
                    reader.GetDateTime(8),

                StartTime =
                    reader.GetFieldValue<TimeSpan>(9),

                EndTime =
                    reader.GetFieldValue<TimeSpan>(10),

                Status =
                    reader.GetString(11),

                Notes =
                    GetNullableString(
                        reader,
                        12),

                CreatedDate =
                    reader.GetDateTime(13),

                UpdatedDate =
                    reader.GetDateTime(14)
            };
        }

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
    }
}
