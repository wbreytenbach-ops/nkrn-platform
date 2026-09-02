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
    public class LogisticsWorkersController : ControllerBase
    {
        private readonly ApplicationDbContext _context;

        public LogisticsWorkersController(
            ApplicationDbContext context)
        {
            _context = context;
        }

        // ============================================================
        // GET ALL LOGISTICS WORKERS
        // ============================================================

        [HttpGet]
        public async Task<IActionResult> GetWorkers(
            [FromQuery] bool includeInactive = false)
        {
            if (!await CanViewLogistics())
            {
                return Forbid();
            }

            var query = _context.LogisticsWorkers
                .AsNoTracking()
                .AsQueryable();

            if (!includeInactive)
            {
                query = query.Where(w => w.IsActive);
            }

            var workers = await query
                .OrderBy(w => w.FirstName)
                .ThenBy(w => w.LastName)
                .Select(w => new
                {
                    w.WorkerID,
                    w.UserID,
                    w.FirstName,
                    w.LastName,

                    FullName =
                        w.FirstName +
                        (
                            w.LastName != null &&
                            w.LastName != ""
                                ? " " + w.LastName
                                : ""
                        ),

                    w.WorkerType,
                    w.Email,
                    w.MobileNumber,
                    w.IsActive,
                    w.CreatedDate,
                    w.UpdatedDate
                })
                .ToListAsync();

            return Ok(workers);
        }

        // ============================================================
        // GET ONE WORKER
        // ============================================================

        [HttpGet("{id}")]
        public async Task<IActionResult> GetWorker(int id)
        {
            if (!await CanViewLogistics())
            {
                return Forbid();
            }

            var worker = await _context.LogisticsWorkers
                .AsNoTracking()
                .Where(w => w.WorkerID == id)
                .Select(w => new
                {
                    w.WorkerID,
                    w.UserID,
                    w.FirstName,
                    w.LastName,

                    FullName =
                        w.FirstName +
                        (
                            w.LastName != null &&
                            w.LastName != ""
                                ? " " + w.LastName
                                : ""
                        ),

                    w.WorkerType,
                    w.Email,
                    w.MobileNumber,
                    w.IsActive,
                    w.CreatedDate,
                    w.UpdatedDate
                })
                .FirstOrDefaultAsync();

            if (worker == null)
            {
                return NotFound(new
                {
                    message = "Logistics worker not found."
                });
            }

            return Ok(worker);
        }

        // ============================================================
        // CREATE WORKER
        // ============================================================

        [HttpPost]
        public async Task<IActionResult> CreateWorker(
            [FromBody] LogisticsWorkerCreateRequest request)
        {
            if (!await CanManageLogistics())
            {
                return Forbid();
            }

            if (string.IsNullOrWhiteSpace(request.FirstName))
            {
                return BadRequest(new
                {
                    message = "First name is required."
                });
            }

            if (request.UserID.HasValue)
            {
                bool userExists = await _context.Users
                    .AnyAsync(u =>
                        u.UserID == request.UserID.Value
                    );

                if (!userExists)
                {
                    return BadRequest(new
                    {
                        message =
                            "The selected NKRN user does not exist."
                    });
                }

                bool userAlreadyLinked =
                    await _context.LogisticsWorkers
                        .AnyAsync(w =>
                            w.UserID == request.UserID.Value
                        );

                if (userAlreadyLinked)
                {
                    return Conflict(new
                    {
                        message =
                            "This NKRN user is already linked to a Logistics worker."
                    });
                }
            }

            string firstName =
                request.FirstName.Trim();

            string? lastName =
                CleanNullableText(
                    request.LastName
                );

            bool duplicateName =
                await _context.LogisticsWorkers
                    .AnyAsync(w =>
                        w.FirstName == firstName &&
                        w.LastName == lastName &&
                        w.IsActive
                    );

            if (duplicateName)
            {
                return Conflict(new
                {
                    message =
                        "An active Logistics worker with this name already exists."
                });
            }

            var worker = new LogisticsWorker
            {
                UserID =
                    request.UserID,

                FirstName =
                    firstName,

                LastName =
                    lastName,

                WorkerType =
                    CleanNullableText(
                        request.WorkerType
                    ),

                Email =
                    CleanNullableText(
                        request.Email
                    ),

                MobileNumber =
                    CleanNullableText(
                        request.MobileNumber
                    ),

                IsActive =
                    true,

                CreatedDate =
                    DateTime.Now
            };

            _context.LogisticsWorkers.Add(worker);

            await _context.SaveChangesAsync();

            return CreatedAtAction(
                nameof(GetWorker),
                new
                {
                    id = worker.WorkerID
                },
                new
                {
                    worker.WorkerID,
                    message =
                        "Logistics worker created successfully."
                }
            );
        }

        // ============================================================
        // UPDATE WORKER
        // ============================================================

        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateWorker(
            int id,
            [FromBody] LogisticsWorkerUpdateRequest request)
        {
            if (!await CanManageLogistics())
            {
                return Forbid();
            }

            var worker =
                await _context.LogisticsWorkers
                    .FirstOrDefaultAsync(
                        w => w.WorkerID == id
                    );

            if (worker == null)
            {
                return NotFound(new
                {
                    message = "Logistics worker not found."
                });
            }

            if (string.IsNullOrWhiteSpace(request.FirstName))
            {
                return BadRequest(new
                {
                    message = "First name is required."
                });
            }

            if (request.UserID.HasValue)
            {
                bool userExists =
                    await _context.Users
                        .AnyAsync(u =>
                            u.UserID == request.UserID.Value
                        );

                if (!userExists)
                {
                    return BadRequest(new
                    {
                        message =
                            "The selected NKRN user does not exist."
                    });
                }

                bool userAlreadyLinked =
                    await _context.LogisticsWorkers
                        .AnyAsync(w =>
                            w.WorkerID != id &&
                            w.UserID == request.UserID.Value
                        );

                if (userAlreadyLinked)
                {
                    return Conflict(new
                    {
                        message =
                            "This NKRN user is already linked to another Logistics worker."
                    });
                }
            }

            string firstName =
                request.FirstName.Trim();

            string? lastName =
                CleanNullableText(
                    request.LastName
                );

            bool duplicateName =
                await _context.LogisticsWorkers
                    .AnyAsync(w =>
                        w.WorkerID != id &&
                        w.FirstName == firstName &&
                        w.LastName == lastName &&
                        w.IsActive
                    );

            if (duplicateName)
            {
                return Conflict(new
                {
                    message =
                        "Another active Logistics worker with this name already exists."
                });
            }

            worker.UserID =
                request.UserID;

            worker.FirstName =
                firstName;

            worker.LastName =
                lastName;

            worker.WorkerType =
                CleanNullableText(
                    request.WorkerType
                );

            worker.Email =
                CleanNullableText(
                    request.Email
                );

            worker.MobileNumber =
                CleanNullableText(
                    request.MobileNumber
                );

            worker.IsActive =
                request.IsActive;

            worker.UpdatedDate =
                DateTime.Now;

            await _context.SaveChangesAsync();

            return Ok(new
            {
                message =
                    "Logistics worker updated successfully."
            });
        }

        // ============================================================
        // DEACTIVATE WORKER
        //
        // We deliberately keep the worker record because historical
        // tasks, work plans and job cards may reference it.
        // ============================================================

        [HttpDelete("{id}")]
        public async Task<IActionResult> DeactivateWorker(
            int id)
        {
            if (!await CanManageLogistics())
            {
                return Forbid();
            }

            var worker =
                await _context.LogisticsWorkers
                    .FirstOrDefaultAsync(
                        w => w.WorkerID == id
                    );

            if (worker == null)
            {
                return NotFound(new
                {
                    message = "Logistics worker not found."
                });
            }

            worker.IsActive = false;
            worker.UpdatedDate = DateTime.Now;

            await _context.SaveChangesAsync();

            return Ok(new
            {
                message =
                    "Logistics worker deactivated successfully."
            });
        }

        // ============================================================
        // PERMISSION HELPERS
        // ============================================================

        private async Task<bool> CanViewLogistics()
        {
            if (User.IsInRole("3"))
            {
                return true;
            }

            int? userID =
                GetLoggedInUserID();

            if (userID == null)
            {
                return false;
            }

            return await _context.ModulePermissions
                .AnyAsync(p =>
                    p.UserID == userID.Value &&
                    p.ModuleKey == "logistics" &&
                    (
                        p.CanView ||
                        p.CanManage ||
                        p.CanAdmin
                    )
                );
        }

        private async Task<bool> CanManageLogistics()
        {
            if (User.IsInRole("3"))
            {
                return true;
            }

            int? userID =
                GetLoggedInUserID();

            if (userID == null)
            {
                return false;
            }

            return await _context.ModulePermissions
                .AnyAsync(p =>
                    p.UserID == userID.Value &&
                    p.ModuleKey == "logistics" &&
                    (
                        p.CanManage ||
                        p.CanAdmin
                    )
                );
        }

        private int? GetLoggedInUserID()
        {
            string? value =
                User.FindFirstValue(
                    ClaimTypes.NameIdentifier
                );

            if (!int.TryParse(
                    value,
                    out int userID))
            {
                return null;
            }

            return userID;
        }

        // ============================================================
        // TEXT CLEANING
        // ============================================================

        private static string? CleanNullableText(
            string? value)
        {
            if (string.IsNullOrWhiteSpace(value))
            {
                return null;
            }

            return value.Trim();
        }
    }

    // ================================================================
    // CREATE REQUEST
    // ================================================================

    public class LogisticsWorkerCreateRequest
    {
        public int? UserID { get; set; }

        public string FirstName { get; set; } =
            string.Empty;

        public string? LastName { get; set; }

        public string? WorkerType { get; set; }

        public string? Email { get; set; }

        public string? MobileNumber { get; set; }
    }

    // ================================================================
    // UPDATE REQUEST
    // ================================================================

    public class LogisticsWorkerUpdateRequest
    {
        public int? UserID { get; set; }

        public string FirstName { get; set; } =
            string.Empty;

        public string? LastName { get; set; }

        public string? WorkerType { get; set; }

        public string? Email { get; set; }

        public string? MobileNumber { get; set; }

        public bool IsActive { get; set; } =
            true;
    }
}