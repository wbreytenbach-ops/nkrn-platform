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
    public class LogisticsWorkPlanController : ControllerBase
    {
        private readonly ApplicationDbContext _context;

        public LogisticsWorkPlanController(
            ApplicationDbContext context)
        {
            _context = context;
        }

        // ============================================================
        // GET WORK PLAN
        //
        // Optional:
        // /api/LogisticsWorkPlan?date=2026-09-01
        // ============================================================

        [HttpGet]
        public async Task<IActionResult> GetWorkPlan(
            [FromQuery] DateTime? date = null)
        {
            if (!await CanViewLogistics())
            {
                return Forbid();
            }

            var query = _context.LogisticsWorkPlanItems
                .AsNoTracking()
                .AsQueryable();

            if (date.HasValue)
            {
                DateTime workDate = date.Value.Date;

                query = query.Where(
                    item => item.WorkDate == workDate
                );
            }

            var items =
                await (
                    from item in query

                    join task
                        in _context.LogisticsTasks
                        on item.TaskID
                        equals task.TaskID
                        into taskJoin

                    from task
                        in taskJoin.DefaultIfEmpty()

                    join worker
                        in _context.LogisticsWorkers
                        on item.WorkerID
                        equals worker.WorkerID
                        into workerJoin

                    from worker
                        in workerJoin.DefaultIfEmpty()

                    join department
                        in _context.LogisticsDepartments
                        on task.DepartmentID
                        equals department.DepartmentID
                        into departmentJoin

                    from department
                        in departmentJoin.DefaultIfEmpty()

                    orderby
                        item.WorkDate,
                        item.Priority,
                        worker.FirstName,
                        item.TaskDescription

                    select new
                    {
                        item.WorkPlanItemID,
                        item.WorkDate,

                        item.TaskID,

                        TaskTitle =
                            task != null
                                ? task.Title
                                : null,

                        DepartmentID =
                            task != null
                                ? task.DepartmentID
                                : null,

                        DepartmentName =
                            department != null
                                ? department.DepartmentName
                                : null,

                        item.WorkerID,

                        WorkerName =
                            worker != null
                                ? worker.FirstName +
                                  (
                                      worker.LastName != null &&
                                      worker.LastName != ""
                                          ? " " + worker.LastName
                                          : ""
                                  )
                                : null,

                        item.Area,
                        item.TaskDescription,
                        item.Priority,

                        item.PlannedStart,
                        item.PlannedEnd,

                        item.MaterialsRequired,
                        item.ManagerNote,

                        item.Status,

                        item.WorkerSignedOffAt,
                        item.ManagerSignedOffAt,

                        item.CreatedByUserID,
                        item.CreatedDate,
                        item.UpdatedDate
                    }
                )
                .ToListAsync();

            return Ok(items);
        }

        // ============================================================
        // GET ONE WORK PLAN ITEM
        // ============================================================

        [HttpGet("{id}")]
        public async Task<IActionResult> GetWorkPlanItem(
            int id)
        {
            if (!await CanViewLogistics())
            {
                return Forbid();
            }

            var item =
                await _context.LogisticsWorkPlanItems
                    .AsNoTracking()
                    .FirstOrDefaultAsync(
                        x => x.WorkPlanItemID == id
                    );

            if (item == null)
            {
                return NotFound(new
                {
                    message =
                        "Logistics work-plan item not found."
                });
            }

            return Ok(item);
        }

        // ============================================================
        // CREATE WORK PLAN ITEM
        // ============================================================

        [HttpPost]
        public async Task<IActionResult> CreateWorkPlanItem(
            [FromBody] LogisticsWorkPlanCreateRequest request)
        {
            if (!await CanManageLogistics())
            {
                return Forbid();
            }

            if (request.WorkDate == default)
            {
                return BadRequest(new
                {
                    message =
                        "Work date is required."
                });
            }

            if (string.IsNullOrWhiteSpace(
                    request.TaskDescription))
            {
                return BadRequest(new
                {
                    message =
                        "Task description is required."
                });
            }

            if (request.TaskID.HasValue)
            {
                bool taskExists =
                    await _context.LogisticsTasks
                        .AnyAsync(t =>
                            t.TaskID ==
                                request.TaskID.Value &&
                            !t.IsArchived
                        );

                if (!taskExists)
                {
                    return BadRequest(new
                    {
                        message =
                            "The selected Logistics task does not exist."
                    });
                }
            }

            if (request.WorkerID.HasValue)
            {
                bool workerExists =
                    await _context.LogisticsWorkers
                        .AnyAsync(w =>
                            w.WorkerID ==
                                request.WorkerID.Value &&
                            w.IsActive
                        );

                if (!workerExists)
                {
                    return BadRequest(new
                    {
                        message =
                            "The selected Logistics worker does not exist."
                    });
                }
            }

            string priority =
                string.IsNullOrWhiteSpace(
                    request.Priority)
                    ? "P3"
                    : request.Priority
                        .Trim()
                        .ToUpper();

            if (!IsValidPriority(priority))
            {
                return BadRequest(new
                {
                    message =
                        "Priority must be P1, P2, P3 or P4."
                });
            }

            var item =
                new LogisticsWorkPlanItem
                {
                    WorkDate =
                        request.WorkDate.Date,

                    TaskID =
                        request.TaskID,

                    WorkerID =
                        request.WorkerID,

                    Area =
                        CleanNullableText(
                            request.Area
                        ),

                    TaskDescription =
                        request.TaskDescription.Trim(),

                    Priority =
                        priority,

                    PlannedStart =
                        request.PlannedStart,

                    PlannedEnd =
                        request.PlannedEnd,

                    MaterialsRequired =
                        CleanNullableText(
                            request.MaterialsRequired
                        ),

                    ManagerNote =
                        CleanNullableText(
                            request.ManagerNote
                        ),

                    Status =
                        string.IsNullOrWhiteSpace(
                            request.Status)
                            ? "Beplan"
                            : request.Status.Trim(),

                    CreatedByUserID =
                        GetLoggedInUserID(),

                    CreatedDate =
                        DateTime.Now
                };

            _context.LogisticsWorkPlanItems.Add(
                item
            );

            await _context.SaveChangesAsync();

            return CreatedAtAction(
                nameof(GetWorkPlanItem),
                new
                {
                    id = item.WorkPlanItemID
                },
                new
                {
                    item.WorkPlanItemID,
                    message =
                        "Work-plan item created successfully."
                }
            );
        }

        // ============================================================
        // UPDATE WORK PLAN ITEM
        // ============================================================

        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateWorkPlanItem(
            int id,
            [FromBody] LogisticsWorkPlanUpdateRequest request)
        {
            if (!await CanManageLogistics())
            {
                return Forbid();
            }

            var item =
                await _context.LogisticsWorkPlanItems
                    .FirstOrDefaultAsync(
                        x =>
                            x.WorkPlanItemID == id
                    );

            if (item == null)
            {
                return NotFound(new
                {
                    message =
                        "Logistics work-plan item not found."
                });
            }

            if (request.WorkDate == default)
            {
                return BadRequest(new
                {
                    message =
                        "Work date is required."
                });
            }

            if (string.IsNullOrWhiteSpace(
                    request.TaskDescription))
            {
                return BadRequest(new
                {
                    message =
                        "Task description is required."
                });
            }

            if (request.WorkerID.HasValue)
            {
                bool workerExists =
                    await _context.LogisticsWorkers
                        .AnyAsync(w =>
                            w.WorkerID ==
                                request.WorkerID.Value &&
                            w.IsActive
                        );

                if (!workerExists)
                {
                    return BadRequest(new
                    {
                        message =
                            "The selected Logistics worker does not exist."
                    });
                }
            }

            string priority =
                string.IsNullOrWhiteSpace(
                    request.Priority)
                    ? item.Priority
                    : request.Priority
                        .Trim()
                        .ToUpper();

            if (!IsValidPriority(priority))
            {
                return BadRequest(new
                {
                    message =
                        "Priority must be P1, P2, P3 or P4."
                });
            }

            item.WorkDate =
                request.WorkDate.Date;

            item.TaskID =
                request.TaskID;

            item.WorkerID =
                request.WorkerID;

            item.Area =
                CleanNullableText(
                    request.Area
                );

            item.TaskDescription =
                request.TaskDescription.Trim();

            item.Priority =
                priority;

            item.PlannedStart =
                request.PlannedStart;

            item.PlannedEnd =
                request.PlannedEnd;

            item.MaterialsRequired =
                CleanNullableText(
                    request.MaterialsRequired
                );

            item.ManagerNote =
                CleanNullableText(
                    request.ManagerNote
                );

            item.Status =
                string.IsNullOrWhiteSpace(
                    request.Status)
                    ? item.Status
                    : request.Status.Trim();

            item.UpdatedDate =
                DateTime.Now;

            await _context.SaveChangesAsync();

            return Ok(new
            {
                message =
                    "Work-plan item updated successfully."
            });
        }

        // ============================================================
        // MARK WORK COMPLETE
        // ============================================================

        [HttpPost("{id}/complete")]
        public async Task<IActionResult> CompleteWorkPlanItem(
            int id)
        {
            if (!await CanManageLogistics())
            {
                return Forbid();
            }

            var item =
                await _context.LogisticsWorkPlanItems
                    .FirstOrDefaultAsync(
                        x =>
                            x.WorkPlanItemID == id
                    );

            if (item == null)
            {
                return NotFound(new
                {
                    message =
                        "Logistics work-plan item not found."
                });
            }

            item.Status =
                "Afgehandel";

            item.ManagerSignedOffAt =
                DateTime.Now;

            item.UpdatedDate =
                DateTime.Now;

            await _context.SaveChangesAsync();

            return Ok(new
            {
                message =
                    "Work-plan item marked as completed."
            });
        }

        // ============================================================
        // DELETE WORK PLAN ITEM
        //
        // Work-plan items may be removed before they are issued on a
        // job card. Once job-card history exists we will protect that
        // workflow separately.
        // ============================================================

        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteWorkPlanItem(
            int id)
        {
            if (!await CanManageLogistics())
            {
                return Forbid();
            }

            var item =
                await _context.LogisticsWorkPlanItems
                    .FirstOrDefaultAsync(
                        x =>
                            x.WorkPlanItemID == id
                    );

            if (item == null)
            {
                return NotFound(new
                {
                    message =
                        "Logistics work-plan item not found."
                });
            }

            bool alreadyOnJobCard =
                await _context.LogisticsJobCardItems
                    .AnyAsync(x =>
                        x.WorkPlanItemID == id
                    );

            if (alreadyOnJobCard)
            {
                return Conflict(new
                {
                    message =
                        "This work-plan item is already part of a job card and cannot be deleted."
                });
            }

            _context.LogisticsWorkPlanItems.Remove(
                item
            );

            await _context.SaveChangesAsync();

            return Ok(new
            {
                message =
                    "Work-plan item deleted successfully."
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
        // VALIDATION HELPERS
        // ============================================================

        private static bool IsValidPriority(
            string priority)
        {
            return priority == "P1" ||
                   priority == "P2" ||
                   priority == "P3" ||
                   priority == "P4";
        }

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

    public class LogisticsWorkPlanCreateRequest
    {
        public DateTime WorkDate { get; set; }

        public int? TaskID { get; set; }

        public int? WorkerID { get; set; }

        public string? Area { get; set; }

        public string TaskDescription { get; set; } =
            string.Empty;

        public string Priority { get; set; } =
            "P3";

        public TimeSpan? PlannedStart { get; set; }

        public TimeSpan? PlannedEnd { get; set; }

        public string? MaterialsRequired { get; set; }

        public string? ManagerNote { get; set; }

        public string Status { get; set; } =
            "Beplan";
    }

    // ================================================================
    // UPDATE REQUEST
    // ================================================================

    public class LogisticsWorkPlanUpdateRequest
    {
        public DateTime WorkDate { get; set; }

        public int? TaskID { get; set; }

        public int? WorkerID { get; set; }

        public string? Area { get; set; }

        public string TaskDescription { get; set; } =
            string.Empty;

        public string Priority { get; set; } =
            "P3";

        public TimeSpan? PlannedStart { get; set; }

        public TimeSpan? PlannedEnd { get; set; }

        public string? MaterialsRequired { get; set; }

        public string? ManagerNote { get; set; }

        public string Status { get; set; } =
            "Beplan";
    }
}