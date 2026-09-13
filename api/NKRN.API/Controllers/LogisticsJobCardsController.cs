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
    public class LogisticsJobCardsController : ControllerBase
    {
        private readonly ApplicationDbContext _context;

        public LogisticsJobCardsController(
            ApplicationDbContext context)
        {
            _context = context;
        }

        // ============================================================
        // GET ALL JOB CARDS
        // ============================================================

        [HttpGet]
        public async Task<IActionResult> GetJobCards(
            [FromQuery] DateTime? date = null)
        {
            if (!await CanViewLogistics())
            {
                return Forbid();
            }

            var query = _context.LogisticsJobCards
                .AsNoTracking()
                .AsQueryable();

            if (date.HasValue)
            {
                DateTime selectedDate = date.Value.Date;

                query = query.Where(card =>
                    card.JobCardDate == selectedDate);
            }

            var cards = await query
                .OrderByDescending(card => card.JobCardDate)
                .ThenByDescending(card => card.GeneratedAt)
                .Select(card => new
                {
                    card.JobCardID,
                    card.JobCardNumber,
                    card.JobCardDate,
                    card.RecipientUserID,
                    card.RecipientEmail,
                    card.Status,
                    card.GeneratedAt,
                    card.SentAt,
                    card.GeneratedByUserID,
                    card.Notes,

                    ItemCount =
                        _context.LogisticsJobCardItems.Count(item =>
                            item.JobCardID == card.JobCardID)
                })
                .ToListAsync();

            return Ok(cards);
        }

        // ============================================================
        // GET ONE JOB CARD
        // ============================================================

        [HttpGet("{id}")]
        public async Task<IActionResult> GetJobCard(int id)
        {
            if (!await CanViewLogistics())
            {
                return Forbid();
            }

            var card = await _context.LogisticsJobCards
                .AsNoTracking()
                .FirstOrDefaultAsync(card =>
                    card.JobCardID == id);

            if (card == null)
            {
                return NotFound(new
                {
                    message = "Logistics job card not found."
                });
            }

            var items = await _context.LogisticsJobCardItems
                .AsNoTracking()
                .Where(item =>
                    item.JobCardID == id)
                .OrderBy(item =>
                    item.SortOrder)
                .Select(item => new
                {
                    item.JobCardItemID,
                    item.WorkPlanItemID,
                    item.TaskID,
                    item.WorkerID,
                    item.WorkerName,
                    item.Area,
                    item.TaskDescription,
                    item.Priority,
                    item.MaterialsRequired,
                    item.ManagerNote,
                    item.Status,
                    item.SortOrder,
                    item.CompletedAt,
                    item.Notes
                })
                .ToListAsync();

            return Ok(new
            {
                card.JobCardID,
                card.JobCardNumber,
                card.JobCardDate,
                card.RecipientUserID,
                card.RecipientEmail,
                card.Status,
                card.GeneratedAt,
                card.SentAt,
                card.GeneratedByUserID,
                card.Notes,
                Items = items
            });
        }

        // ============================================================
        // GENERATE DAILY JOB CARD
        // ============================================================

        [HttpPost("generate")]
        public async Task<IActionResult> GenerateJobCard(
            [FromQuery] DateTime? date = null)
        {
            if (!await CanManageLogistics())
            {
                return Forbid();
            }

            DateTime jobCardDate =
                (date ?? DateTime.Today).Date;

            var settings = await _context.LogisticsSettings
                .AsNoTracking()
                .FirstOrDefaultAsync(settings =>
                    settings.SettingsID == 1);

            if (settings == null)
            {
                return BadRequest(new
                {
                    message =
                        "Logistics settings have not been configured."
                });
            }

            if (!settings.ManagerUserID.HasValue)
            {
                return BadRequest(new
                {
                    message =
                        "A Logistics Manager has not been configured."
                });
            }

            var manager = await _context.Users
                .AsNoTracking()
                .FirstOrDefaultAsync(user =>
                    user.UserID == settings.ManagerUserID.Value &&
                    user.IsActive);

            if (manager == null)
            {
                return BadRequest(new
                {
                    message =
                        "The configured Logistics Manager could not be found."
                });
            }

            string recipientEmail =
                !string.IsNullOrWhiteSpace(settings.EmailOverride)
                    ? settings.EmailOverride.Trim()
                    : manager.Email ?? string.Empty;

            if (string.IsNullOrWhiteSpace(recipientEmail))
            {
                return BadRequest(new
                {
                    message =
                        "The Logistics Manager does not have an email address."
                });
            }

            bool alreadyExists =
                await _context.LogisticsJobCards.AnyAsync(card =>
                    card.JobCardDate == jobCardDate);

            if (alreadyExists)
            {
                return Conflict(new
                {
                    message =
                        $"A job card has already been generated for {jobCardDate:yyyy-MM-dd}."
                });
            }

            // ========================================================
            // LOAD WORK PLAN
            // ========================================================

            var workPlanQuery =
                _context.LogisticsWorkPlanItems
                    .AsNoTracking()
                    .AsQueryable();

            if (settings.CarryOverIncompleteWork)
            {
                workPlanQuery = workPlanQuery.Where(item =>
                    item.WorkDate == jobCardDate ||
                    (
                        item.WorkDate < jobCardDate &&
                        item.Status != "Afgehandel"
                    ));
            }
            else
            {
                workPlanQuery = workPlanQuery.Where(item =>
                    item.WorkDate == jobCardDate);
            }

            var workPlanItems = await workPlanQuery
                .OrderBy(item => item.Priority)
                .ThenBy(item => item.WorkerID)
                .ThenBy(item => item.WorkPlanItemID)
                .ToListAsync();

            // ========================================================
            // FIND TASKS ALREADY INCLUDED THROUGH WORK PLAN
            // ========================================================

            var representedTaskIDs =
                workPlanItems
                    .Where(item =>
                        item.TaskID.HasValue)
                    .Select(item =>
                        item.TaskID!.Value)
                    .Distinct()
                    .ToList();

            // ========================================================
            // OVERDUE TASKS
            // ========================================================

            var overdueTasks =
                new List<LogisticsTask>();

            if (settings.IncludeOverdueTasks)
            {
                overdueTasks =
                    await _context.LogisticsTasks
                        .AsNoTracking()
                        .Where(task =>
                            !task.IsArchived &&
                            task.IncludeOnJobCard &&
                            task.Status != "Afgehandel" &&
                            task.DueDate.HasValue &&
                            task.DueDate.Value < jobCardDate &&
                            !representedTaskIDs.Contains(task.TaskID))
                        .OrderBy(task => task.Priority)
                        .ThenBy(task => task.DueDate)
                        .ToListAsync();
            }

            if (workPlanItems.Count == 0 &&
                overdueTasks.Count == 0)
            {
                return BadRequest(new
                {
                    message =
                        "There is no work available for this job card."
                });
            }

            // ========================================================
            // LOAD TASK INFORMATION
            // ========================================================

            var taskIDs =
                workPlanItems
                    .Where(item =>
                        item.TaskID.HasValue)
                    .Select(item =>
                        item.TaskID!.Value)
                    .Concat(
                        overdueTasks.Select(task =>
                            task.TaskID))
                    .Distinct()
                    .ToList();

            var tasks =
                await _context.LogisticsTasks
                    .AsNoTracking()
                    .Where(task =>
                        taskIDs.Contains(task.TaskID))
                    .ToListAsync();

            var taskLookup =
                tasks.ToDictionary(
                    task => task.TaskID);

            // ========================================================
            // LOAD DEPARTMENTS
            // ========================================================

            var departmentIDs =
                tasks
                    .Where(task =>
                        task.DepartmentID.HasValue)
                    .Select(task =>
                        task.DepartmentID!.Value)
                    .Distinct()
                    .ToList();

            var departments =
                await _context.LogisticsDepartments
                    .AsNoTracking()
                    .Where(department =>
                        departmentIDs.Contains(
                            department.DepartmentID))
                    .ToListAsync();

            var departmentLookup =
                departments.ToDictionary(
                    department => department.DepartmentID,
                    department => department.DepartmentName);

            // ========================================================
            // LOAD WORKERS
            // ========================================================

            var workerIDs =
                workPlanItems
                    .Where(item =>
                        item.WorkerID.HasValue)
                    .Select(item =>
                        item.WorkerID!.Value)
                    .Concat(
                        overdueTasks
                            .Where(task =>
                                task.ResponsibleWorkerID.HasValue)
                            .Select(task =>
                                task.ResponsibleWorkerID!.Value))
                    .Distinct()
                    .ToList();

            var workers =
                await _context.LogisticsWorkers
                    .AsNoTracking()
                    .Where(worker =>
                        workerIDs.Contains(worker.WorkerID))
                    .ToListAsync();

            var workerLookup =
                workers.ToDictionary(
                    worker => worker.WorkerID,
                    worker => BuildWorkerName(worker));

            // ========================================================
            // CREATE JOB CARD HEADER
            // ========================================================

            var jobCard =
                new LogisticsJobCard
                {
                    JobCardNumber =
                        $"LJC-{jobCardDate:yyyyMMdd}",

                    JobCardDate =
                        jobCardDate,

                    RecipientUserID =
                        manager.UserID,

                    RecipientEmail =
                        recipientEmail,

                    Status =
                        "Generated",

                    GeneratedAt =
                        DateTime.Now,

                    SentAt =
                        null,

                    GeneratedByUserID =
                        GetLoggedInUserID(),

                    Notes =
                        null
                };

            await using var transaction =
                await _context.Database
                    .BeginTransactionAsync();

            try
            {
                _context.LogisticsJobCards.Add(jobCard);

                await _context.SaveChangesAsync();

                int sortOrder = 1;

                // ====================================================
                // SNAPSHOT WORK PLAN ITEMS
                // ====================================================

                foreach (var workItem in workPlanItems)
                {
                    string? workerName = null;
                    string? departmentName = null;

                    if (workItem.WorkerID.HasValue)
                    {
                        workerLookup.TryGetValue(
                            workItem.WorkerID.Value,
                            out workerName);
                    }

                    if (workItem.TaskID.HasValue &&
                        taskLookup.TryGetValue(
                            workItem.TaskID.Value,
                            out var linkedTask))
                    {
                        if (linkedTask.DepartmentID.HasValue)
                        {
                            departmentLookup.TryGetValue(
                                linkedTask.DepartmentID.Value,
                                out departmentName);
                        }
                    }

                    var item =
                        new LogisticsJobCardItem
                        {
                            JobCardID =
                                jobCard.JobCardID,

                            WorkPlanItemID =
                                workItem.WorkPlanItemID,

                            TaskID =
                                workItem.TaskID,

                            WorkerID =
                                workItem.WorkerID,

                            WorkerName =
                                workerName,

                            Area =
                                !string.IsNullOrWhiteSpace(workItem.Area)
                                    ? workItem.Area
                                    : departmentName,

                            TaskDescription =
                                workItem.TaskDescription,

                            Priority =
                                workItem.Priority,

                            MaterialsRequired =
                                workItem.MaterialsRequired,

                            ManagerNote =
                                workItem.ManagerNote,

                            Status =
                                workItem.Status,

                            SortOrder =
                                sortOrder++,

                            CompletedAt =
                                null,

                            Notes =
                                workItem.WorkDate < jobCardDate
                                    ? $"Carried over from {workItem.WorkDate:yyyy-MM-dd}."
                                    : null
                        };

                    _context.LogisticsJobCardItems.Add(item);
                }

                // ====================================================
                // SNAPSHOT OVERDUE TASKS
                // ====================================================

                foreach (var task in overdueTasks)
                {
                    string? workerName = null;
                    string? departmentName = null;

                    if (task.ResponsibleWorkerID.HasValue)
                    {
                        workerLookup.TryGetValue(
                            task.ResponsibleWorkerID.Value,
                            out workerName);
                    }

                    if (task.DepartmentID.HasValue)
                    {
                        departmentLookup.TryGetValue(
                            task.DepartmentID.Value,
                            out departmentName);
                    }

                    string managerNote =
                        !string.IsNullOrWhiteSpace(task.NextAction)
                            ? "Overdue task. Next action: " +
                              task.NextAction
                            : "Overdue task.";

                    var item =
                        new LogisticsJobCardItem
                        {
                            JobCardID =
                                jobCard.JobCardID,

                            WorkPlanItemID =
                                null,

                            TaskID =
                                task.TaskID,

                            WorkerID =
                                task.ResponsibleWorkerID,

                            WorkerName =
                                workerName,

                            Area =
                                departmentName,

                            TaskDescription =
                                task.Title,

                            Priority =
                                task.Priority,

                            MaterialsRequired =
                                null,

                            ManagerNote =
                                managerNote,

                            Status =
                                task.Status,

                            SortOrder =
                                sortOrder++,

                            CompletedAt =
                                null,

                            Notes =
                                task.DueDate.HasValue
                                    ? $"Due date: {task.DueDate.Value:yyyy-MM-dd}."
                                    : null
                        };

                    _context.LogisticsJobCardItems.Add(item);
                }

                await _context.SaveChangesAsync();

                await transaction.CommitAsync();

                return CreatedAtAction(
                    nameof(GetJobCard),
                    new
                    {
                        id = jobCard.JobCardID
                    },
                    new
                    {
                        jobCard.JobCardID,
                        jobCard.JobCardNumber,
                        jobCard.JobCardDate,
                        jobCard.RecipientEmail,

                        WorkPlanItems =
                            workPlanItems.Count,

                        OverdueTasks =
                            overdueTasks.Count,

                        TotalItems =
                            workPlanItems.Count +
                            overdueTasks.Count,

                        message =
                            "Daily Logistics job card generated successfully."
                    });
            }
            catch
            {
                await transaction.RollbackAsync();
                throw;
            }
        }

        // ============================================================
        // PERMISSIONS
        // ============================================================

        private async Task<bool> CanViewLogistics()
        {
            if (User.IsInRole("3"))
            {
                return true;
            }

            int? userID = GetLoggedInUserID();

            if (!userID.HasValue)
            {
                return false;
            }

            return await _context.ModulePermissions
                .AnyAsync(permission =>
                    permission.UserID == userID.Value &&
                    permission.ModuleKey == "logistics" &&
                    (
                        permission.CanView ||
                        permission.CanManage ||
                        permission.CanAdmin
                    ));
        }

        private async Task<bool> CanManageLogistics()
        {
            if (User.IsInRole("3"))
            {
                return true;
            }

            int? userID = GetLoggedInUserID();

            if (!userID.HasValue)
            {
                return false;
            }

            return await _context.ModulePermissions
                .AnyAsync(permission =>
                    permission.UserID == userID.Value &&
                    permission.ModuleKey == "logistics" &&
                    (
                        permission.CanManage ||
                        permission.CanAdmin
                    ));
        }

        private int? GetLoggedInUserID()
        {
            string? claim =
                User.FindFirstValue(
                    ClaimTypes.NameIdentifier);

            if (!int.TryParse(
                    claim,
                    out int userID))
            {
                return null;
            }

            return userID;
        }

        private static string BuildWorkerName(
            LogisticsWorker worker)
        {
            if (string.IsNullOrWhiteSpace(
                    worker.LastName))
            {
                return worker.FirstName;
            }

            return worker.FirstName +
                   " " +
                   worker.LastName;
        }
    }
}