using System.Data;
using System.Data.Common;
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
    public class LocationsController : ControllerBase
    {
        private readonly ApplicationDbContext _context;

        public LocationsController(
            ApplicationDbContext context)
        {
            _context = context;
        }

        // ============================================================
        // ALL ACTIVE SCHOOL LOCATIONS
        // ============================================================

        [HttpGet]
        public async Task<ActionResult<IEnumerable<LocationResponse>>> GetLocations(
            [FromQuery] bool? bookable = null)
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
                    WHERE
                        IsActive = 1
                        AND
                        (@Bookable IS NULL
                            OR CanBeBooked = @Bookable)
                    ORDER BY
                        DisplayOrder,
                        LocationName;
                    """;

                AddParameter(
                    command,
                    "@Bookable",
                    bookable);

                await using var reader =
                    await command.ExecuteReaderAsync();

                while (await reader.ReadAsync())
                {
                    output.Add(
                        MapLocation(reader));
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
        // ONE LOCATION
        // ============================================================

        [HttpGet("{id:int}")]
        public async Task<ActionResult<LocationResponse>> GetLocation(
            int id)
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
                    WHERE LocationID = @LocationID;
                    """;

                AddParameter(
                    command,
                    "@LocationID",
                    id);

                await using var reader =
                    await command.ExecuteReaderAsync();

                if (!await reader.ReadAsync())
                {
                    return NotFound();
                }

                return Ok(
                    MapLocation(reader));
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
        // VENUE AVAILABILITY CHECK
        // Overlap rule:
        // existing.Start < requested.End
        // AND existing.End > requested.Start
        // ============================================================

        [HttpGet("{id:int}/availability")]
        public async Task<IActionResult> CheckAvailability(
            int id,
            [FromQuery] DateTime date,
            [FromQuery] TimeSpan startTime,
            [FromQuery] TimeSpan endTime)
        {
            if (endTime <= startTime)
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
                var conflicts =
                    new List<VenueBookingResponse>();

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
                        B.LocationID = @LocationID
                        AND B.BookingDate = @BookingDate
                        AND B.Status IN ('Pending', 'Confirmed')
                        AND B.StartTime < @EndTime
                        AND B.EndTime > @StartTime
                    ORDER BY B.StartTime;
                    """;

                AddParameter(
                    command,
                    "@LocationID",
                    id);

                AddParameter(
                    command,
                    "@BookingDate",
                    date.Date);

                AddParameter(
                    command,
                    "@StartTime",
                    startTime);

                AddParameter(
                    command,
                    "@EndTime",
                    endTime);

                await using var reader =
                    await command.ExecuteReaderAsync();

                while (await reader.ReadAsync())
                {
                    conflicts.Add(
                        MapBooking(reader));
                }

                return Ok(new
                {
                    available =
                        conflicts.Count == 0,

                    conflicts
                });
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

        private static LocationResponse MapLocation(
            DbDataReader reader)
        {
            return new LocationResponse
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
            };
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
