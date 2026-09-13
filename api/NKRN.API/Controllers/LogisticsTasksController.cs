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
    public class LogisticsTasksController : ControllerBase
    {
        private readonly ApplicationDbContext _context;

        public LogisticsTasksController(
            ApplicationDbContext context)
        {
            _context = context;
        }

        // ============================================================
        // GET ALL LOGISTICS TASKS
        //
        // Optional filters:
        //   departmentID
        //   priority
        //   status
        //   includeArchived
        // ============================================================

        [HttpGet]
        public async Task<IActionResult> GetTasks(
            [FromQuery] int? departmentID = null,
            [FromQuery] string? priority = null,
            [FromQuery] string? status = null,
            [FromQuery] bool includeArchived = false)
        {
            if (!await CanViewLogistics())
            {
                return Forbid();
            }

            var query = _context.LogisticsTasks
                .AsNoTracking()
                .AsQueryable();

            if (!includeArchived)
            {
                query = query.Where(t => !t.IsArchived);
            }

            if (departmentID.HasValue)
            {
                query = query.Where(
                    t => t.DepartmentID == departmentID.Value
                );
            }

            if (!string.IsNullOrWhiteSpace(priority))
            {
                string cleanPriority =
                    priority.Trim().ToUpper();

                query = query.Where(
                    t => t.Priority == cleanPriority
                );
            }

            if (!string.IsNullOrWhiteSpace(status))
            {
                string cleanStatus = status.Trim();

                query = query.Where(
                    t => t.Status == cleanStatus
                );
            }

            var tasks =
                await (
                    from task in query

                    join department
                        in _context.LogisticsDepartments
                        on task.DepartmentID
                        equals department.DepartmentID
                        into departmentJoin

                    from department
                        in departmentJoin.DefaultIfEmpty()

                    join worker
                        in _context.LogisticsWorkers
                        on task.ResponsibleWorkerID
                        equals worker.WorkerID
                        into workerJoin

                    from worker
                        in workerJoin.DefaultIfEmpty()

                    join responsibleUser
                        in _context.Users
                        on task.ResponsibleUserID
                        equals responsibleUser.UserID
                        into responsibleUserJoin

                    from responsibleUser
                        in responsibleUserJoin.DefaultIfEmpty()

                    join requestedBy
                        in _context.Users
                        on task.RequestedByUserID
                        equals requestedBy.UserID
                        into requestedByJoin

                    from requestedBy
                        in requestedByJoin.DefaultIfEmpty()

                    orderby
                        task.Priority,
                        task.DueDate,
                        task.CreatedDate descending

                    select new
                    {
                        task.TaskID,
                        task.DepartmentID,

                        DepartmentName =
                            department != null
                                ? department.DepartmentName
                                : null,

                        task.Title,
                        task.Background,
                        task.RequestedDate,
                        task.RequestedByUserID,

                        RequestedByName =
                            requestedBy != null
                                ? requestedBy.FirstName + " " +
                                  requestedBy.LastName
                                : null,

                        task.Priority,

                        task.ResponsibleUserID,

                        ResponsibleUserName =
                            responsibleUser != null
                                ? responsibleUser.FirstName + " " +
                                  responsibleUser.LastName
                                : null,

                        task.ResponsibleWorkerID,

                        ResponsibleWorkerName =
                            worker != null
                                ? worker.FirstName + " " +
                                  (worker.LastName ?? "")
                                : null,

                        task.ResponsibleText,

                        task.QuoteRequired,
                        task.QuoteReceived,

                        task.DueDate,
                        task.DueDateNote,

                        task.Status,
                        task.NextAction,

                        task.ContractorName,
                        task.BudgetAmount,
                        task.ApprovalStatus,

                        task.CompletedDate,

                        task.LastFollowUp,
                        task.NextFollowUp,

                        task.Notes,

                        task.IncludeOnJobCard,
                        task.IsArchived,

                        task.CreatedDate,
                        task.UpdatedDate
                    }
                )
                .ToListAsync();

            return Ok(tasks);
        }

        // ============================================================
        // GET ONE TASK
        // ============================================================

        [HttpGet("{id}")]
        public async Task<IActionResult> GetTask(int id)
        {
            if (!await CanViewLogistics())
            {
                return Forbid();
            }

            var task =
                await (
                    from item
                        in _context.LogisticsTasks
                            .AsNoTracking()

                    where item.TaskID == id

                    join department
                        in _context.LogisticsDepartments
                        on item.DepartmentID
                        equals department.DepartmentID
                        into departmentJoin

                    from department
                        in departmentJoin.DefaultIfEmpty()

                    join worker
                        in _context.LogisticsWorkers
                        on item.ResponsibleWorkerID
                        equals worker.WorkerID
                        into workerJoin

                    from worker
                        in workerJoin.DefaultIfEmpty()

                    join responsibleUser
                        in _context.Users
                        on item.ResponsibleUserID
                        equals responsibleUser.UserID
                        into responsibleUserJoin

                    from responsibleUser
                        in responsibleUserJoin.DefaultIfEmpty()

                    select new
                    {
                        item.TaskID,
                        item.DepartmentID,

                        DepartmentName =
                            department != null
                                ? department.DepartmentName
                                : null,

                        item.Title,
                        item.Background,

                        item.RequestedDate,
                        item.RequestedByUserID,

                        item.Priority,

                        item.ResponsibleUserID,

                        ResponsibleUserName =
                            responsibleUser != null
                                ? responsibleUser.FirstName + " " +
                                  responsibleUser.LastName
                                : null,

                        item.ResponsibleWorkerID,

                        ResponsibleWorkerName =
                            worker != null
                                ? worker.FirstName + " " +
                                  (worker.LastName ?? "")
                                : null,

                        item.ResponsibleText,

                        item.QuoteRequired,
                        item.QuoteReceived,

                        item.DueDate,
                        item.DueDateNote,

                        item.Status,
                        item.NextAction,

                        item.ContractorName,
                        item.BudgetAmount,
                        item.ApprovalStatus,

                        item.CompletedDate,

                        item.LastFollowUp,
                        item.NextFollowUp,

                        item.Notes,

                        item.IncludeOnJobCard,
                        item.IsArchived,

                        item.CreatedDate,
                        item.UpdatedDate
                    }
                )
                .FirstOrDefaultAsync();

            if (task == null)
            {
                return NotFound(new
                {
                    message = "Logistics task not found."
                });
            }

            return Ok(task);
        }

        // ============================================================
        // CREATE TASK
        // ============================================================

        [HttpPost]
        public async Task<IActionResult> CreateTask(
            [FromBody] LogisticsTaskCreateRequest request)
        {
            if (!await CanManageLogistics())
            {
                return Forbid();
            }

            if (string.IsNullOrWhiteSpace(request.Title))
            {
                return BadRequest(new
                {
                    message = "Task title is required."
                });
            }

            string priority =
                string.IsNullOrWhiteSpace(request.Priority)
                    ? "P3"
                    : request.Priority.Trim().ToUpper();

            if (!IsValidPriority(priority))
            {
                return BadRequest(new
                {
                    message =
                        "Priority must be P1, P2, P3 or P4."
                });
            }

            if (request.DepartmentID.HasValue)
            {
                bool departmentExists =
                    await _context.LogisticsDepartments
                        .AnyAsync(d =>
                            d.DepartmentID ==
                                request.DepartmentID.Value &&
                            d.IsActive
                        );

                if (!departmentExists)
                {
                    return BadRequest(new
                    {
                        message =
                            "The selected Logistics department does not exist."
                    });
                }
            }

            if (request.ResponsibleWorkerID.HasValue)
            {
                bool workerExists =
                    await _context.LogisticsWorkers
                        .AnyAsync(w =>
                            w.WorkerID ==
                                request.ResponsibleWorkerID.Value &&
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

            if (request.ResponsibleUserID.HasValue)
            {
                bool userExists =
                    await _context.Users
                        .AnyAsync(u =>
                            u.UserID ==
                                request.ResponsibleUserID.Value
                        );

                if (!userExists)
                {
                    return BadRequest(new
                    {
                        message =
                            "The selected responsible user does not exist."
                    });
                }
            }

            int? loggedInUserID =
                GetLoggedInUserID();

            var task = new LogisticsTask
            {
                DepartmentID =
                    request.DepartmentID,

                Title =
                    request.Title.Trim(),

                Background =
                    CleanNullableText(
                        request.Background
                    ),

                RequestedDate =
                    request.RequestedDate ??
                    DateTime.Today,

                RequestedByUserID =
                    request.RequestedByUserID ??
                    loggedInUserID,

                Priority =
                    priority,

                ResponsibleUserID =
                    request.ResponsibleUserID,

                ResponsibleWorkerID =
                    request.ResponsibleWorkerID,

                ResponsibleText =
                    CleanNullableText(
                        request.ResponsibleText
                    ),

                QuoteRequired =
                    request.QuoteRequired,

                QuoteReceived =
                    request.QuoteReceived,

                DueDate =
                    request.DueDate,

                DueDateNote =
                    CleanNullableText(
                        request.DueDateNote
                    ),

                Status =
                    string.IsNullOrWhiteSpace(request.Status)
                        ? "Nog nie begin"
                        : request.Status.Trim(),

                NextAction =
                    CleanNullableText(
                        request.NextAction
                    ),

                ContractorName =
                    CleanNullableText(
                        request.ContractorName
                    ),

                BudgetAmount =
                    request.BudgetAmount,

                ApprovalStatus =
                    CleanNullableText(
                        request.ApprovalStatus
                    ),

                CompletedDate =
                    request.CompletedDate,

                LastFollowUp =
                    request.LastFollowUp,

                NextFollowUp =
                    request.NextFollowUp,

                Notes =
                    CleanNullableText(
                        request.Notes
                    ),

                IncludeOnJobCard =
                    request.IncludeOnJobCard,

                IsArchived = false,

                CreatedDate =
                    DateTime.Now
            };

            _context.LogisticsTasks.Add(task);

            await _context.SaveChangesAsync();

            return CreatedAtAction(
                nameof(GetTask),
                new
                {
                    id = task.TaskID
                },
                new
                {
                    task.TaskID,
                    message =
                        "Logistics task created successfully."
                }
            );
        }

        // ============================================================
        // UPDATE TASK
        // ============================================================

        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateTask(
            int id,
            [FromBody] LogisticsTaskUpdateRequest request)
        {
            if (!await CanManageLogistics())
            {
                return Forbid();
            }

            var task =
                await _context.LogisticsTasks
                    .FirstOrDefaultAsync(
                        t => t.TaskID == id
                    );

            if (task == null)
            {
                return NotFound(new
                {
                    message = "Logistics task not found."
                });
            }

            if (string.IsNullOrWhiteSpace(request.Title))
            {
                return BadRequest(new
                {
                    message = "Task title is required."
                });
            }

            string priority =
                string.IsNullOrWhiteSpace(request.Priority)
                    ? task.Priority
                    : request.Priority.Trim().ToUpper();

            if (!IsValidPriority(priority))
            {
                return BadRequest(new
                {
                    message =
                        "Priority must be P1, P2, P3 or P4."
                });
            }

            task.DepartmentID =
                request.DepartmentID;

            task.Title =
                request.Title.Trim();

            task.Background =
                CleanNullableText(
                    request.Background
                );

            task.RequestedDate =
                request.RequestedDate;

            task.RequestedByUserID =
                request.RequestedByUserID;

            task.Priority =
                priority;

            task.ResponsibleUserID =
                request.ResponsibleUserID;

            task.ResponsibleWorkerID =
                request.ResponsibleWorkerID;

            task.ResponsibleText =
                CleanNullableText(
                    request.ResponsibleText
                );

            task.QuoteRequired =
                request.QuoteRequired;

            task.QuoteReceived =
                request.QuoteReceived;

            task.DueDate =
                request.DueDate;

            task.DueDateNote =
                CleanNullableText(
                    request.DueDateNote
                );

            task.Status =
                string.IsNullOrWhiteSpace(request.Status)
                    ? task.Status
                    : request.Status.Trim();

            task.NextAction =
                CleanNullableText(
                    request.NextAction
                );

            task.ContractorName =
                CleanNullableText(
                    request.ContractorName
                );

            task.BudgetAmount =
                request.BudgetAmount;

            task.ApprovalStatus =
                CleanNullableText(
                    request.ApprovalStatus
                );

            task.CompletedDate =
                request.CompletedDate;

            task.LastFollowUp =
                request.LastFollowUp;

            task.NextFollowUp =
                request.NextFollowUp;

            task.Notes =
                CleanNullableText(
                    request.Notes
                );

            task.IncludeOnJobCard =
                request.IncludeOnJobCard;

            task.UpdatedDate =
                DateTime.Now;

            await _context.SaveChangesAsync();

            return Ok(new
            {
                message =
                    "Logistics task updated successfully."
            });
        }

        // ============================================================
        // ARCHIVE TASK
        //
        // We do not physically delete operational records.
        // ============================================================

        [HttpDelete("{id}")]
        public async Task<IActionResult> ArchiveTask(int id)
        {
            if (!await CanManageLogistics())
            {
                return Forbid();
            }

            var task =
                await _context.LogisticsTasks
                    .FirstOrDefaultAsync(
                        t => t.TaskID == id
                    );

            if (task == null)
            {
                return NotFound(new
                {
                    message = "Logistics task not found."
                });
            }

            task.IsArchived = true;
            task.UpdatedDate = DateTime.Now;

            await _context.SaveChangesAsync();

            return Ok(new
            {
                message =
                    "Logistics task archived successfully."
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

    public class LogisticsTaskCreateRequest
    {
        public int? DepartmentID { get; set; }

        public string Title { get; set; } =
            string.Empty;

        public string? Background { get; set; }

        public DateTime? RequestedDate { get; set; }

        public int? RequestedByUserID { get; set; }

        public string Priority { get; set; } =
            "P3";

        public int? ResponsibleUserID { get; set; }

        public int? ResponsibleWorkerID { get; set; }

        public string? ResponsibleText { get; set; }

        public bool QuoteRequired { get; set; }

        public bool QuoteReceived { get; set; }

        public DateTime? DueDate { get; set; }

        public string? DueDateNote { get; set; }

        public string Status { get; set; } =
            "Nog nie begin";

        public string? NextAction { get; set; }

        public string? ContractorName { get; set; }

        public decimal? BudgetAmount { get; set; }

        public string? ApprovalStatus { get; set; }

        public DateTime? CompletedDate { get; set; }

        public DateTime? LastFollowUp { get; set; }

        public DateTime? NextFollowUp { get; set; }

        public string? Notes { get; set; }

        public bool IncludeOnJobCard { get; set; } =
            true;
    }

    // ================================================================
    // UPDATE REQUEST
    // ================================================================

    public class LogisticsTaskUpdateRequest
    {
        public int? DepartmentID { get; set; }

        public string Title { get; set; } =
            string.Empty;

        public string? Background { get; set; }

        public DateTime? RequestedDate { get; set; }

        public int? RequestedByUserID { get; set; }

        public string Priority { get; set; } =
            "P3";

        public int? ResponsibleUserID { get; set; }

        public int? ResponsibleWorkerID { get; set; }

        public string? ResponsibleText { get; set; }

        public bool QuoteRequired { get; set; }

        public bool QuoteReceived { get; set; }

        public DateTime? DueDate { get; set; }

        public string? DueDateNote { get; set; }

        public string Status { get; set; } =
            "Nog nie begin";

        public string? NextAction { get; set; }

        public string? ContractorName { get; set; }

        public decimal? BudgetAmount { get; set; }

        public string? ApprovalStatus { get; set; }

        public DateTime? CompletedDate { get; set; }

        public DateTime? LastFollowUp { get; set; }

        public DateTime? NextFollowUp { get; set; }

        public string? Notes { get; set; }

        public bool IncludeOnJobCard { get; set; } =
            true;
    }
}