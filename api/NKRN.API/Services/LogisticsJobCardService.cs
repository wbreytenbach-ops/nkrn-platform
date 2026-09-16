using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using NKRN.API.Data;
using NKRN.API.Models;
using System.Net;
using System.Text;
namespace NKRN.API.Services;

public class LogisticsJobCardService(ApplicationDbContext context, EmailService email, IOptions<LogisticsAutomationOptions> options, ILogger<LogisticsJobCardService> logger, IHostEnvironment environment)
{
    private readonly ApplicationDbContext _context = context;
    private readonly LogisticsAutomationOptions _options = options.Value;
    public async Task<LogisticsJobCard> GenerateAsync(DateTime date, int? generatedBy)
    {
            DateTime jobCardDate =
                date.Date;

            await using var transaction = await _context.Database.BeginTransactionAsync();
            await _context.Database.ExecuteSqlInterpolatedAsync($"DECLARE @r int; EXEC @r = sp_getapplock @Resource={"NKRN:Logistics:daily:" + jobCardDate.ToString("yyyyMMdd")}, @LockMode='Exclusive', @LockOwner='Transaction', @LockTimeout=30000; IF @r < 0 THROW 51000, 'Could not lock daily job card', 1;");
            var existing = await _context.LogisticsJobCards.FirstOrDefaultAsync(c => c.JobCardDate == jobCardDate);
            if (existing != null) { await transaction.CommitAsync(); return existing; }
            var settings = await _context.LogisticsSettings.AsNoTracking().FirstOrDefaultAsync(s => s.SettingsID == 1)
                ?? throw new InvalidOperationException("Logistics settings have not been configured.");
            string recipientEmail = string.Join(";", _options.MasterRecipientEmails.Select(a => a.Trim()).Where(a => a.Length > 0).Distinct(StringComparer.OrdinalIgnoreCase));

            // ========================================================
            // LOAD WORK PLAN
            // ========================================================

            var workPlanQuery =
                _context.LogisticsWorkPlanItems
                    .AsNoTracking()
                    .Where(item => item.Status != "Cancelled" && item.Status != "Gekanselleer" &&
                        (!item.TaskID.HasValue || !_context.LogisticsTasks.Any(t => t.TaskID == item.TaskID && (t.IsArchived || t.Status == "Afgehandel" || t.Status == "Completed" || t.Status == "Cancelled"))))
                    .AsQueryable();

            if (settings.CarryOverIncompleteWork)
            {
                workPlanQuery = workPlanQuery.Where(item =>
                    item.WorkDate == jobCardDate ||
                    (
                        item.WorkDate < jobCardDate &&
                        item.Status != "Afgehandel" && item.Status != "Completed" && item.Status != "Cancelled" && item.Status != "Gekanselleer"
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
                            task.Status != "Afgehandel" && task.Status != "Completed" && task.Status != "Cancelled" && task.Status != "Gekanselleer" &&
                            task.DueDate.HasValue &&
                            task.DueDate.Value < jobCardDate &&
                            !representedTaskIDs.Contains(task.TaskID))
                        .OrderBy(task => task.Priority)
                        .ThenBy(task => task.DueDate)
                        .ToListAsync();
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
                        settings.ManagerUserID,

                    RecipientEmail =
                        recipientEmail,

                    Status =
                        "Generated",

                    GeneratedAt =
                        DateTime.UtcNow,

                    SentAt =
                        null,

                    GeneratedByUserID =
                        generatedBy,

                    Notes = _options.GenerateWorkerCards
                        ? "Werkerdrukkaarte is uit hierdie meesterkaart se momentopname beskikbaar." : null
                };

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
                            PlannedStart = workItem.PlannedStart,
                            PlannedEnd = workItem.PlannedEnd,

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

                return jobCard;
            }
            catch
            {
                await transaction.RollbackAsync();
                throw;
            }
    }
    private static string BuildWorkerName(LogisticsWorker worker) => $"{worker.FirstName} {worker.LastName}".Trim();

    public async Task<LogisticsJobCard> SendAsync(int id, bool manualRetry = false)
    {
        if (environment.IsDevelopment() && !_options.RunInDevelopment)
            throw new InvalidOperationException("Logistics-e-pos is vir ontwikkeling afgeskakel.");
        await _context.Database.OpenConnectionAsync();
        bool locked = false;
        try
        {
            await _context.Database.ExecuteSqlInterpolatedAsync($"DECLARE @r int; EXEC @r = sp_getapplock @Resource={"NKRN:Logistics:send:" + id}, @LockMode='Exclusive', @LockOwner='Session', @LockTimeout=0; IF @r < 0 THROW 51000, 'Delivery is still in progress', 1;");
            locked = true;
        var card = await _context.LogisticsJobCards.AsNoTracking().SingleOrDefaultAsync(c => c.JobCardID == id)
            ?? throw new InvalidOperationException("Werkkaart is nie gevind nie.");
        if (card.SentAt.HasValue || card.Status == "Sent") return card;
        var items = await _context.LogisticsJobCardItems.AsNoTracking().Where(i => i.JobCardID == id).OrderBy(i => i.SortOrder).ToListAsync();
        var recipients = _options.MasterRecipientEmails.Select(a => a.Trim()).Where(a => a.Length > 0).Distinct(StringComparer.OrdinalIgnoreCase).ToArray();
        if (recipients.Length == 0) throw new InvalidOperationException("Card has no recipient.");
        var recipientList = string.Join(";", recipients);
        if (recipientList.Length > 255) throw new InvalidOperationException("Master recipient list exceeds the configured database limit.");
        // Durable atomic claim: ambiguous SMTP outcomes are never retried automatically.
        var claimed = await _context.LogisticsJobCards.Where(c => c.JobCardID == id && c.SentAt == null &&
            (c.Status == "Generated" || c.Status == "Draft" || (manualRetry && c.Status == "Failed")))
            .ExecuteUpdateAsync(set => set.SetProperty(c => c.Status, "Sending").SetProperty(c => c.RecipientEmail, recipientList));
        if (claimed == 0) throw new InvalidOperationException("Card is sent, sending, or awaiting a manager's delivery review.");
        try
        {
            await email.SendEmailToManyAsync(recipients, $"Daaglikse Logistics werkkaart - {card.JobCardDate:yyyy-MM-dd}", BuildEmailBody(card, items));
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Logistics email failed for card {CardID}; manager review required before retry", id);
            await _context.LogisticsJobCards.Where(c => c.JobCardID == id).ExecuteUpdateAsync(set => set
                .SetProperty(c => c.Status, "Failed").SetProperty(c => c.DeliveryNote, "Aflewering kon nie bevestig word nie. Gaan pos na voordat u weer stuur."));
            throw new InvalidOperationException("Email delivery could not be confirmed. Review mailbox before retrying.");
        }
        // A failure after SMTP acceptance leaves Sending persisted; never blindly resend after restart.
        await _context.LogisticsJobCards.Where(c => c.JobCardID == id).ExecuteUpdateAsync(set => set
            .SetProperty(c => c.Status, "Sent").SetProperty(c => c.SentAt, DateTime.UtcNow).SetProperty(c => c.DeliveryNote, (string?)null));
        return await _context.LogisticsJobCards.AsNoTracking().SingleAsync(c => c.JobCardID == id);
        }
        finally
        {
            try { if (locked) await _context.Database.ExecuteSqlInterpolatedAsync($"EXEC sp_releaseapplock @Resource={"NKRN:Logistics:send:" + id}, @LockOwner='Session';"); }
            finally { await _context.Database.CloseConnectionAsync(); }
        }
    }
        private static string BuildEmailBody(
            LogisticsJobCard card,
            List<LogisticsJobCardItem> items)
        {
            var html = new StringBuilder();

            html.Append(
                "<html><body style='font-family:Arial,sans-serif;background:#f4f4f4;padding:20px;'>");

            html.Append(
                "<div style='max-width:760px;margin:auto;background:#ffffff;border-radius:10px;overflow:hidden;'>");

            html.Append(
                "<div style='background:#171717;color:#ffffff;padding:24px;'>");

            html.Append(
                "<div style='font-size:12px;letter-spacing:1px;'>LAERSKOOL TYGERPOORT</div>");

            html.Append(
                "<h1 style='margin:6px 0 0 0;'>Daaglikse Logistics-werkkaart</h1>");

            html.Append("</div>");
            if (items.Count == 0) html.Append("<p style='padding:20px'>Geen werk is tans vir hierdie datum beplan nie / No work is currently scheduled for this date.</p>");

            html.Append(
                "<div style='padding:24px;'>");

            html.Append(
                "<p><strong>Werkkaart:</strong> " +
                Encode(card.JobCardNumber) +
                "</p>");

            html.Append(
                "<p><strong>Datum:</strong> " +
                Encode(
                    card.JobCardDate.ToString(
                        "dd MMMM yyyy")) +
                "</p>");

            html.Append(
                "<p><strong>Aantal take:</strong> " +
                items.Count +
                "</p>");

            var groups = items.GroupBy(item => item.WorkerID)
                .OrderBy(group => group.First().WorkerName ?? "Nie toegeken nie");

            foreach (var group in groups)
            {
                html.Append(
                    "<h2 style='border-bottom:2px solid #d7a31f;padding-bottom:8px;margin-top:28px;'>" +
                    Encode(group.First().WorkerName ?? "Nie toegeken nie") +
                    "</h2>");

                foreach (var item in group)
                {
                    html.Append(
                        "<div style='border:1px solid #dddddd;border-radius:8px;padding:15px;margin-bottom:12px;'>");

                    html.Append(
                        "<strong>" +
                        Encode(item.TaskDescription) +
                        "</strong>");

                    html.Append(
                        "<p><strong>Prioriteit:</strong> " +
                        Encode(LogisticsWorkflow.PriorityLabel(item.Priority)) +
                        "</p>");

                    if (!string.IsNullOrWhiteSpace(
                            item.Area))
                    {
                        html.Append(
                            "<p><strong>Area:</strong> " +
                            Encode(item.Area) +
                            "</p>");
                    }

                    if (!string.IsNullOrWhiteSpace(
                            item.MaterialsRequired))
                    {
                        html.Append(
                            "<p><strong>Materiaal:</strong> " +
                            Encode(item.MaterialsRequired) +
                            "</p>");
                    }

                    if (!string.IsNullOrWhiteSpace(
                            item.ManagerNote))
                    {
                        html.Append(
                            "<p><strong>Nota:</strong> " +
                            Encode(item.ManagerNote) +
                            "</p>");
                    }

                    html.Append(
                        "<p><strong>Status:</strong> " +
                        Encode(LogisticsWorkflow.StatusLabel(item.Status)) +
                        "</p>");

                    html.Append("</div>");
                }
            }

            html.Append(
                "<p style='margin-top:30px;border-top:1px solid #dddddd;padding-top:15px;font-size:12px;color:#777777;'>");

            html.Append(
                "Hierdie jobcard is outomaties uit die Logistieke werkplan saamgestel.");

            html.Append("</p>");

            html.Append("</div>");
            html.Append("</div>");
            html.Append("</body></html>");

            return html.ToString();
        }

        // ============================================================
        // HTML ENCODE
        // ============================================================

        private static string Encode(
            string? value)
        {
            return WebUtility.HtmlEncode(
                value ?? string.Empty);
        }

}
