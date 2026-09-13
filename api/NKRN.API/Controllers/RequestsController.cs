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
    public class RequestsController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        private readonly EmailService _emailService;
        private readonly GoogleCalendarService _calendarService;
        private readonly IConfiguration _configuration;

        private const string GoogleCalendarUser =
            "itdesk@tygerpoort.co.za";

        public RequestsController(
            ApplicationDbContext context,
            EmailService emailService,
            GoogleCalendarService calendarService,
            IConfiguration configuration)
        {
            _context = context;
            _emailService = emailService;
            _calendarService = calendarService;
            _configuration = configuration;
        }

        // ========================================
        // GET ALL REQUESTS
        // TECHNICIAN + ADMIN ONLY
        // ========================================

        [Authorize(Roles = "2,3")]
        [HttpGet]
        public async Task<ActionResult<IEnumerable<Request>>> GetRequests()
        {
            var requests = await _context.Requests
                .OrderByDescending(r => r.CreatedDate)
                .ToListAsync();

            return Ok(requests);
        }

        // ========================================
        // GET REQUESTS FOR ONE USER
        // ========================================

        [Authorize]
        [HttpGet("user/{userID}")]
        public async Task<ActionResult<IEnumerable<Request>>> GetUserRequests(
            int userID)
        {
            var loggedInUserID = GetLoggedInUserID();

            if (loggedInUserID == null)
            {
                return Unauthorized();
            }

            var isTechnicianOrAdmin =
                User.IsInRole("2") ||
                User.IsInRole("3");

            if (!isTechnicianOrAdmin &&
                loggedInUserID.Value != userID)
            {
                return Forbid();
            }

            var requests = await _context.Requests
                .Where(r => r.UserID == userID)
                .OrderByDescending(r => r.CreatedDate)
                .ToListAsync();

            return Ok(requests);
        }

        // ========================================
        // GET ONE REQUEST
        // ========================================

        [Authorize]
        [HttpGet("{id}")]
        public async Task<ActionResult<Request>> GetRequest(int id)
        {
            var request = await _context.Requests
                .FindAsync(id);

            if (request == null)
            {
                return NotFound();
            }

            var loggedInUserID = GetLoggedInUserID();

            if (loggedInUserID == null)
            {
                return Unauthorized();
            }

            var isTechnicianOrAdmin =
                User.IsInRole("2") ||
                User.IsInRole("3");

            if (!isTechnicianOrAdmin &&
                request.UserID != loggedInUserID.Value)
            {
                return Forbid();
            }

            return Ok(request);
        }

        // ========================================
        // CREATE REQUEST
        // AUTHENTICATED USERS ONLY
        // ========================================

        [Authorize]
        [HttpPost]
        public async Task<ActionResult<Request>> CreateRequest(
            Request request)
        {
            var loggedInUserID = GetLoggedInUserID();

            if (loggedInUserID == null)
            {
                return Unauthorized();
            }

            // ========================================
            // GET AUTHENTICATED USER
            // ========================================

            var loggedInUser =
                await _context.Users
                    .FirstOrDefaultAsync(
                        u => u.UserID == loggedInUserID.Value
                    );

            if (loggedInUser == null)
            {
                return Unauthorized();
            }

            // ========================================
            // ALWAYS USE AUTHENTICATED USER ID
            // ========================================

            request.UserID = loggedInUserID.Value;

            // ========================================
            // SERVER CONTROLS CREATION DATE
            // ========================================

            request.CreatedDate = DateTime.Now;

            // ========================================
            // NEW REQUESTS START AS LOGGED
            // ========================================

            request.StatusID = 1;

            // ========================================
            // ROLE-BASED REQUEST DETAILS
            //
            // Role 1 = Teacher/User
            // Role 2 = Technician
            // Role 3 = Admin
            // ========================================

            var isTechnicianOrAdmin =
                User.IsInRole("2") ||
                User.IsInRole("3");

            if (!isTechnicianOrAdmin)
            {
                // ========================================
                // TEACHER DEFAULT PRIORITY
                // ========================================

                request.Priority = "Medium";

                // ========================================
                // TEACHER DEFAULT CATEGORY
                // ========================================

                var defaultCategory =
                    await _context.Categories
                        .OrderBy(c => c.CategoryID)
                        .FirstOrDefaultAsync();

                if (defaultCategory == null)
                {
                    return BadRequest(
                        "No request categories are configured."
                    );
                }

                request.CategoryID =
                    defaultCategory.CategoryID;
            }
            else
            {
                // ========================================
                // TECHNICIAN / ADMIN
                // ========================================

                if (request.CategoryID <= 0)
                {
                    return BadRequest(
                        "A valid category is required."
                    );
                }

                if (string.IsNullOrWhiteSpace(
                    request.Priority))
                {
                    request.Priority = "Medium";
                }
            }

            // ========================================
            // SAVE REQUEST
            // ========================================

            _context.Requests.Add(request);

            await _context.SaveChangesAsync();

            // ========================================
            // SEND EMAIL TO ALL ACTIVE ADMINS
            // ========================================

            try
            {
                var administrators =
                    await _context.Users
                        .Where(u =>
                            u.RoleID == 3 &&
                            u.IsActive &&
                            !string.IsNullOrWhiteSpace(
                                u.Email))
                        .ToListAsync();

                if (administrators.Count == 0)
                {
                    Console.WriteLine(
                        "No active administrators with email addresses were found."
                    );
                }
                else
                {
                    var category =
                        await _context.Categories
                            .FirstOrDefaultAsync(
                                c =>
                                    c.CategoryID ==
                                    request.CategoryID
                            );

                    var categoryName =
                        category?.CategoryName
                        ?? "Unknown";

                    var subject =
                        $"New IT Request #{request.RequestID} - {request.Title}";

                    var body = $"""
                        <html>
                        <body style="font-family: Arial, sans-serif; color: #222;">

                            <h2>New IT Support Request</h2>

                            <p>
                                A new IT support request has been submitted
                                through the Tygerpoort IT Desk.
                            </p>

                            <hr />

                            <h3>Request Details</h3>

                            <p>
                                <strong>Request ID:</strong>
                                #{request.RequestID}
                            </p>

                            <p>
                                <strong>Submitted by:</strong>
                                {loggedInUser.FirstName} {loggedInUser.LastName}
                            </p>

                            <p>
                                <strong>Email:</strong>
                                {loggedInUser.Email}
                            </p>

                            <p>
                                <strong>Title:</strong>
                                {request.Title}
                            </p>

                            <p>
                                <strong>Description:</strong><br />
                                {request.Description}
                            </p>

                            <p>
                                <strong>Priority:</strong>
                                {request.Priority}
                            </p>

                            <p>
                                <strong>Category:</strong>
                                {categoryName}
                            </p>

                            <p>
                                <strong>Status:</strong>
                                Logged
                            </p>

                            <p>
                                <strong>Created:</strong>
                                {request.CreatedDate}
                            </p>

                            <hr />

                            <p>
                                <strong>Tygerpoort IT Desk</strong><br />
                                Technical Support Portal
                            </p>

                        </body>
                        </html>
                        """;

                    foreach (var administrator
                        in administrators)
                    {
                        try
                        {
                            await _emailService.SendEmailAsync(
                                administrator.Email,
                                subject,
                                body
                            );

                            Console.WriteLine(
                                $"New request notification sent to Admin {administrator.Email} for Request #{request.RequestID}."
                            );
                        }
                        catch (Exception adminEmailException)
                        {
                            Console.WriteLine(
                                "========================================"
                            );

                            Console.WriteLine(
                                $"ADMIN EMAIL ERROR - {administrator.Email}"
                            );

                            Console.WriteLine(
                                adminEmailException.Message
                            );

                            Console.WriteLine(
                                adminEmailException.InnerException?.Message
                            );

                            Console.WriteLine(
                                "========================================"
                            );
                        }
                    }
                }
            }
            catch (Exception emailException)
            {
                Console.WriteLine(
                    "========================================"
                );

                Console.WriteLine(
                    "NEW REQUEST EMAIL ERROR"
                );

                Console.WriteLine(
                    emailException.Message
                );

                Console.WriteLine(
                    emailException.InnerException?.Message
                );

                Console.WriteLine(
                    "========================================"
                );
            }

            // ========================================
            // RETURN CREATED REQUEST
            // ========================================

            return CreatedAtAction(
                nameof(GetRequest),
                new
                {
                    id = request.RequestID
                },
                request
            );
        }

        // ========================================
        // UPDATE REQUEST
        // TECHNICIAN + ADMIN ONLY
        // ========================================

        [Authorize(Roles = "2,3")]
        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateRequest(
            int id,
            Request request)
        {
            try
            {
                // ========================================
                // CHECK ID
                // ========================================

                if (id != request.RequestID)
                {
                    return BadRequest(
                        "Request ID does not match the URL."
                    );
                }

                // ========================================
                // FIND EXISTING REQUEST
                // ========================================

                var existingRequest =
                    await _context.Requests
                        .FirstOrDefaultAsync(
                            r => r.RequestID == id
                        );

                if (existingRequest == null)
                {
                    return NotFound(
                        $"Request #{id} was not found."
                    );
                }

                // ========================================
                // REMEMBER ORIGINAL VALUES
                // ========================================

                var previousAssignedTo =
                    existingRequest.AssignedTo;

                var newAssignedTo =
                    request.AssignedTo;

                var assignmentChanged =
                    previousAssignedTo != newAssignedTo;

                var previousStatusID =
                    existingRequest.StatusID;

                var newStatusID =
                    request.StatusID;

                var statusChanged =
                    previousStatusID != newStatusID;

                var previousScheduledStart =
                    existingRequest.ScheduledStart;

                var previousScheduledEnd =
                    existingRequest.ScheduledEnd;

                var scheduleChanged =
                    previousScheduledStart !=
                        request.ScheduledStart ||
                    previousScheduledEnd !=
                        request.ScheduledEnd;

                // ========================================
                // UPDATE MANAGED FIELDS
                // ========================================

                existingRequest.Title =
                    request.Title;

                existingRequest.Description =
                    request.Description;

                existingRequest.Priority =
                    request.Priority;

                existingRequest.AssignedTo =
                    request.AssignedTo;

                existingRequest.CategoryID =
                    request.CategoryID;

                existingRequest.StatusID =
                    request.StatusID;

                // ========================================
                // GOOGLE CALENDAR SCHEDULING
                // ========================================

                existingRequest.ScheduledStart =
                    request.ScheduledStart;

                existingRequest.ScheduledEnd =
                    request.ScheduledEnd;

                // ========================================
                // VALIDATE SCHEDULE
                // ========================================

                if (existingRequest.ScheduledStart.HasValue &&
                    existingRequest.ScheduledEnd.HasValue)
                {
                    if (existingRequest.ScheduledEnd.Value <=
                        existingRequest.ScheduledStart.Value)
                    {
                        return BadRequest(
                            "The scheduled end time must be after the scheduled start time."
                        );
                    }
                }

                // ========================================
                // COMPLETION DATE
                // ========================================

                if (request.StatusID == 3)
                {
                    if (existingRequest.CompletedDate == null)
                    {
                        existingRequest.CompletedDate =
                            DateTime.Now;
                    }
                }
                else
                {
                    existingRequest.CompletedDate =
                        null;
                }

                // ========================================
                // SAVE REQUEST CHANGES
                // ========================================

                await _context.SaveChangesAsync();

                // ========================================
                // GOOGLE CALENDAR
                //
                // ATTENDEES:
                // 1. Requester
                // 2. Assigned technician
                // 3. All active administrators
                // ========================================

                if (existingRequest.ScheduledStart.HasValue &&
                    existingRequest.ScheduledEnd.HasValue)
                {
                    // We need to create the event if it does not exist.
                    // We also need to update it when the schedule or
                    // assigned technician changes.
                    var calendarNeedsUpdate =
                        string.IsNullOrWhiteSpace(
                            existingRequest.GoogleCalendarEventID) ||
                        assignmentChanged ||
                        scheduleChanged;

                    if (calendarNeedsUpdate)
                    {
                        try
                        {
                            // ========================================
                            // GET REQUESTER
                            // ========================================

                            var requester =
                                await _context.Users
                                    .FirstOrDefaultAsync(
                                        u =>
                                            u.UserID ==
                                            existingRequest.UserID &&
                                            u.IsActive
                                    );

                            // ========================================
                            // GET ASSIGNED TECHNICIAN
                            // ========================================

                            var assignedTechnician =
                                existingRequest.AssignedTo.HasValue
                                    ? await _context.Users
                                        .FirstOrDefaultAsync(
                                            u =>
                                                u.UserID ==
                                                existingRequest.AssignedTo.Value &&
                                                u.IsActive
                                        )
                                    : null;

                            // ========================================
                            // GET ALL ACTIVE ADMINS
                            // ========================================

                            var administrators =
                                await _context.Users
                                    .Where(u =>
                                        u.RoleID == 3 &&
                                        u.IsActive &&
                                        !string.IsNullOrWhiteSpace(
                                            u.Email))
                                    .ToListAsync();

                            // ========================================
                            // BUILD ATTENDEE LIST
                            // ========================================

                            var attendeeEmails =
                                new List<string>();

                            // Requester
                            if (requester != null &&
                                !string.IsNullOrWhiteSpace(
                                    requester.Email))
                            {
                                attendeeEmails.Add(
                                    requester.Email.Trim()
                                );
                            }

                            // Assigned technician
                            if (assignedTechnician != null &&
                                !string.IsNullOrWhiteSpace(
                                    assignedTechnician.Email))
                            {
                                attendeeEmails.Add(
                                    assignedTechnician.Email.Trim()
                                );
                            }

                            // All active administrators
                            foreach (var administrator
                                in administrators)
                            {
                                if (!string.IsNullOrWhiteSpace(
                                    administrator.Email))
                                {
                                    attendeeEmails.Add(
                                        administrator.Email.Trim()
                                    );
                                }
                            }

                            // ========================================
                            // REMOVE DUPLICATES
                            // ========================================

                            attendeeEmails =
                                attendeeEmails
                                    .Distinct(
                                        StringComparer.OrdinalIgnoreCase)
                                    .ToList();

                            // ========================================
                            // LOG ATTENDEES
                            // ========================================

                            Console.WriteLine(
                                "========================================"
                            );

                            Console.WriteLine(
                                $"GOOGLE CALENDAR ATTENDEES - REQUEST #{existingRequest.RequestID}"
                            );

                            foreach (var attendeeEmail
                                in attendeeEmails)
                            {
                                Console.WriteLine(
                                    attendeeEmail
                                );
                            }

                            Console.WriteLine(
                                "========================================"
                            );

                            // ========================================
                            // CALENDAR DESCRIPTION
                            // ========================================

                            var description =
                                $"Tygerpoort IT Desk Request #{existingRequest.RequestID}\n\n" +
                                $"Title: {existingRequest.Title}\n\n" +
                                $"Description:\n{existingRequest.Description}\n\n" +
                                $"Priority: {existingRequest.Priority}\n\n" +
                                $"Status: {GetStatusName(existingRequest.StatusID)}";

                            // ========================================
                            // CREATE NEW CALENDAR EVENT
                            // ========================================

                            if (string.IsNullOrWhiteSpace(
                                existingRequest.GoogleCalendarEventID))
                            {
                                var eventId =
                                    await _calendarService.CreateEventAsync(
                                        GoogleCalendarUser,
                                        $"IT Desk - #{existingRequest.RequestID} - {existingRequest.Title}",
                                        description,
                                        existingRequest.ScheduledStart.Value,
                                        existingRequest.ScheduledEnd.Value,
                                        attendeeEmails
                                    );

                                existingRequest.GoogleCalendarEventID =
                                    eventId;

                                await _context.SaveChangesAsync();

                                Console.WriteLine(
                                    $"Google Calendar event created for Request #{existingRequest.RequestID}. Event ID: {eventId}"
                                );
                            }

                            // ========================================
                            // UPDATE EXISTING CALENDAR EVENT
                            // ========================================

                            else
                            {
                                await _calendarService.UpdateEventAsync(
                                    GoogleCalendarUser,
                                    existingRequest.GoogleCalendarEventID,
                                    $"IT Desk - #{existingRequest.RequestID} - {existingRequest.Title}",
                                    description,
                                    existingRequest.ScheduledStart.Value,
                                    existingRequest.ScheduledEnd.Value,
                                    attendeeEmails
                                );

                                Console.WriteLine(
                                    $"Google Calendar event updated for Request #{existingRequest.RequestID}. Event ID: {existingRequest.GoogleCalendarEventID}"
                                );
                            }
                        }
                        catch (Exception calendarException)
                        {
                            Console.WriteLine(
                                "========================================"
                            );

                            Console.WriteLine(
                                "GOOGLE CALENDAR ERROR"
                            );

                            Console.WriteLine(
                                calendarException.Message
                            );

                            Console.WriteLine(
                                calendarException.InnerException?.Message
                            );

                            Console.WriteLine(
                                calendarException.StackTrace
                            );

                            Console.WriteLine(
                                "========================================"
                            );
                        }
                    }
                }

                // ========================================
                // SEND ASSIGNMENT EMAIL
                // ========================================

                if (assignmentChanged &&
                    newAssignedTo.HasValue)
                {
                    try
                    {
                        var assignedTechnician =
                            await _context.Users
                                .FirstOrDefaultAsync(
                                    u =>
                                        u.UserID ==
                                        newAssignedTo.Value &&
                                        u.IsActive
                                );

                        if (assignedTechnician != null)
                        {
                            var subject =
                                $"IT Request #{existingRequest.RequestID} Assigned to You";

                            var body = $"""
                                <html>
                                <body style="font-family: Arial, sans-serif; color: #222;">

                                    <h2>IT Support Request Assigned</h2>

                                    <p>
                                        Hello {assignedTechnician.FirstName},
                                    </p>

                                    <p>
                                        An IT support request has been assigned
                                        to you through the Tygerpoort IT Desk.
                                    </p>

                                    <hr />

                                    <h3>Request Details</h3>

                                    <p>
                                        <strong>Request ID:</strong>
                                        #{existingRequest.RequestID}
                                    </p>

                                    <p>
                                        <strong>Title:</strong>
                                        {existingRequest.Title}
                                    </p>

                                    <p>
                                        <strong>Description:</strong><br />
                                        {existingRequest.Description}
                                    </p>

                                    <p>
                                        <strong>Priority:</strong>
                                        {existingRequest.Priority}
                                    </p>

                                    <p>
                                        <strong>Category ID:</strong>
                                        {existingRequest.CategoryID}
                                    </p>

                                    <p>
                                        <strong>Status:</strong>
                                        {GetStatusName(existingRequest.StatusID)}
                                    </p>

                                    <p>
                                        <strong>Created:</strong>
                                        {existingRequest.CreatedDate}
                                    </p>

                                    <hr />

                                    <p>
                                        Please log in to the Tygerpoort IT Desk
                                        to view and manage this request.
                                    </p>

                                    <p>
                                        <strong>Tygerpoort IT Desk</strong><br />
                                        Technical Support Portal
                                    </p>

                                </body>
                                </html>
                                """;

                            await _emailService.SendEmailAsync(
                                assignedTechnician.Email,
                                subject,
                                body
                            );

                            Console.WriteLine(
                                $"Assignment email sent to {assignedTechnician.Email} for Request #{existingRequest.RequestID}."
                            );
                        }
                        else
                        {
                            Console.WriteLine(
                                $"Assignment email was not sent because User #{newAssignedTo.Value} was not found or is inactive."
                            );
                        }
                    }
                    catch (Exception emailException)
                    {
                        Console.WriteLine(
                            "========================================"
                        );

                        Console.WriteLine(
                            "ASSIGNMENT EMAIL ERROR"
                        );

                        Console.WriteLine(
                            emailException.Message
                        );

                        Console.WriteLine(
                            emailException.InnerException?.Message
                        );

                        Console.WriteLine(
                            "========================================"
                        );
                    }
                }

                // ========================================
                // SEND STATUS EMAIL TO REQUESTER
                // ========================================

                if (statusChanged)
                {
                    try
                    {
                        var requester =
                            await _context.Users
                                .FirstOrDefaultAsync(
                                    u =>
                                        u.UserID ==
                                        existingRequest.UserID &&
                                        u.IsActive
                                );

                        if (requester != null &&
                            !string.IsNullOrWhiteSpace(
                                requester.Email))
                        {
                            var statusName =
                                GetStatusName(
                                    existingRequest.StatusID
                                );

                            string subject;
                            string heading;
                            string message;

                            if (existingRequest.StatusID == 2)
                            {
                                subject =
                                    $"IT Request #{existingRequest.RequestID} - Being Worked On";

                                heading =
                                    "Your IT Support Request Is Being Worked On";

                                message = """
                                    Your IT support request has been picked up
                                    by the IT Desk and is currently being worked on.
                                    """;
                            }
                            else if (existingRequest.StatusID == 3)
                            {
                                subject =
                                    $"IT Request #{existingRequest.RequestID} - Completed";

                                heading =
                                    "Your IT Support Request Has Been Completed";

                                message = """
                                    Your IT support request has been marked as
                                    completed by the Tygerpoort IT Desk.
                                    """;
                            }
                            else
                            {
                                subject =
                                    $"IT Request #{existingRequest.RequestID} - Status Updated";

                                heading =
                                    "Your IT Support Request Has Been Updated";

                                message =
                                    $"Your IT support request status has been updated to <strong>{statusName}</strong>.";
                            }

                            var body = $"""
                                <html>
                                <body style="font-family: Arial, sans-serif; color: #222;">

                                    <h2>{heading}</h2>

                                    <p>
                                        Hello {requester.FirstName},
                                    </p>

                                    <p>
                                        {message}
                                    </p>

                                    <hr />

                                    <h3>Request Details</h3>

                                    <p>
                                        <strong>Request ID:</strong>
                                        #{existingRequest.RequestID}
                                    </p>

                                    <p>
                                        <strong>Title:</strong>
                                        {existingRequest.Title}
                                    </p>

                                    <p>
                                        <strong>Status:</strong>
                                        {statusName}
                                    </p>

                                    <p>
                                        <strong>Priority:</strong>
                                        {existingRequest.Priority}
                                    </p>

                                    <p>
                                        <strong>Created:</strong>
                                        {existingRequest.CreatedDate}
                                    </p>

                                    {(existingRequest.CompletedDate.HasValue
                                        ? $"""
                                        <p>
                                            <strong>Completed:</strong>
                                            {existingRequest.CompletedDate}
                                        </p>
                                        """
                                        : "")}

                                    <hr />

                                    <p>
                                        You can log in to the Tygerpoort IT Desk
                                        to view the latest status of your request.
                                    </p>

                                    <p>
                                        <strong>Tygerpoort IT Desk</strong><br />
                                        Technical Support Portal
                                    </p>

                                </body>
                                </html>
                                """;

                            await _emailService.SendEmailAsync(
                                requester.Email,
                                subject,
                                body
                            );

                            Console.WriteLine(
                                $"Status email sent to {requester.Email} for Request #{existingRequest.RequestID}. New status: {statusName}"
                            );
                        }
                        else
                        {
                            Console.WriteLine(
                                $"Status email was not sent because requester for Request #{existingRequest.RequestID} could not be found or has no email address."
                            );
                        }
                    }
                    catch (Exception emailException)
                    {
                        Console.WriteLine(
                            "========================================"
                        );

                        Console.WriteLine(
                            "STATUS EMAIL ERROR"
                        );

                        Console.WriteLine(
                            emailException.Message
                        );

                        Console.WriteLine(
                            emailException.InnerException?.Message
                        );

                        Console.WriteLine(
                            "========================================"
                        );
                    }
                }

                return NoContent();
            }
            catch (DbUpdateException ex)
            {
                Console.WriteLine(
                    "========================================"
                );

                Console.WriteLine(
                    "DATABASE UPDATE ERROR"
                );

                Console.WriteLine(
                    ex.Message
                );

                Console.WriteLine(
                    ex.InnerException?.Message
                );

                Console.WriteLine(
                    "========================================"
                );

                return StatusCode(
                    StatusCodes.Status500InternalServerError,
                    new
                    {
                        message =
                            "The request could not be saved to the database.",
                        error =
                            ex.InnerException?.Message
                            ?? ex.Message
                    }
                );
            }
            catch (Exception ex)
            {
                Console.WriteLine(
                    "========================================"
                );

                Console.WriteLine(
                    "REQUEST UPDATE ERROR"
                );

                Console.WriteLine(
                    ex.Message
                );

                Console.WriteLine(
                    ex.InnerException?.Message
                );

                Console.WriteLine(
                    "========================================"
                );

                return StatusCode(
                    StatusCodes.Status500InternalServerError,
                    new
                    {
                        message =
                            "An unexpected error occurred while updating the request.",
                        error =
                            ex.InnerException?.Message
                            ?? ex.Message
                    }
                );
            }
        }

        // ========================================
        // GET STATUS NAME
        // ========================================

        private static string GetStatusName(
            int? statusID)
        {
            return statusID switch
            {
                1 => "Logged",
                2 => "Busy",
                3 => "Done",
                _ => "Unknown"
            };
        }

        // ========================================
        // GET LOGGED-IN USER ID FROM JWT
        // ========================================

        private int? GetLoggedInUserID()
        {
            var userIDClaim =
                User.FindFirst(
                    ClaimTypes.NameIdentifier
                )?.Value;

            if (int.TryParse(
                userIDClaim,
                out var userID))
            {
                return userID;
            }

            return null;
        }
    }
}