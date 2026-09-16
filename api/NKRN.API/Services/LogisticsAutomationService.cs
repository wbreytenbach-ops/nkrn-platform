using Microsoft.Extensions.Options;
using Microsoft.EntityFrameworkCore;
using NKRN.API.Data;
namespace NKRN.API.Services;

public class LogisticsAutomationOptions
{
    public bool Enabled { get; set; } = true;
    public bool RunInDevelopment { get; set; }
    // Null permits existing database DailyJobCardTime to remain authoritative.
    public string? DailyRunTime { get; set; }
    public string TimeZoneId { get; set; } = "Africa/Johannesburg";
    public string MasterRecipientEmail { get; set; } = "terreinbestuur@tygies.co.za";
    public string[] MasterRecipientEmails { get; set; } = ["terreinbestuur@tygies.co.za", "mcarnie@tygies.co.za"];
    public bool GenerateWorkerCards { get; set; } = true;
    public bool SyncCalendar { get; set; }
    public string CalendarUserId { get; set; } = "itdesk@tygerpoort.co.za";
    public static TimeZoneInfo Zone(string id = "Africa/Johannesburg")
    {
        try { return TimeZoneInfo.FindSystemTimeZoneById(id); }
        catch (TimeZoneNotFoundException) when (id is "Africa/Johannesburg" or "South Africa Standard Time")
        { return TimeZoneInfo.FindSystemTimeZoneById(id == "Africa/Johannesburg" ? "South Africa Standard Time" : "Africa/Johannesburg"); }
    }
    public static DateTime LocalNow() => TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, Zone());
    public static bool IsDue(DateTime now, TimeSpan runTime, bool weekdaysOnly) =>
        now.TimeOfDay >= runTime && (!weekdaysOnly || (now.DayOfWeek != DayOfWeek.Saturday && now.DayOfWeek != DayOfWeek.Sunday));
}

public sealed class LogisticsAutomationService(IServiceScopeFactory scopes, IOptions<LogisticsAutomationOptions> options,
    IHostEnvironment environment, ILogger<LogisticsAutomationService> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var config = options.Value;
        if (!config.Enabled || (environment.IsDevelopment() && !config.RunInDevelopment)) return;
        using var timer = new PeriodicTimer(TimeSpan.FromMinutes(1));
        do
        {
            try
            {
                using var scope = scopes.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
                var settings = await db.LogisticsSettings.AsNoTracking().FirstOrDefaultAsync(s => s.SettingsID == 1, stoppingToken);
                var now = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, LogisticsAutomationOptions.Zone(config.TimeZoneId));
                var runAt = config.DailyRunTime == null ? settings?.DailyJobCardTime ?? TimeSpan.FromHours(6) : TimeSpan.Parse(config.DailyRunTime);
                if (runAt < TimeSpan.Zero || runAt >= TimeSpan.FromDays(1)) throw new InvalidOperationException("DailyRunTime must be a time of day.");
                if (config.SyncCalendar)
                {
                    var sync = scope.ServiceProvider.GetRequiredService<LogisticsCalendarSyncService>();
                    var ids = await db.LogisticsWorkPlanItems.Where(i => i.CalendarSyncStatus == "Pending" || i.CalendarSyncStatus == "Failed")
                        .Select(i => i.WorkPlanItemID).Take(100).ToListAsync(stoppingToken);
                    foreach (var id in ids) await sync.SyncAsync(id);
                }
                if (settings?.DailyJobCardEnabled == true && LogisticsAutomationOptions.IsDue(now, runAt, settings.WeekdaysOnly))
                {
                    var cards = scope.ServiceProvider.GetRequiredService<LogisticsJobCardService>();
                    var card = await cards.GenerateAsync(now.Date, null);
                    if (card.SentAt == null && card.Status is "Generated" or "Draft") await cards.SendAsync(card.JobCardID);
                }
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { break; }
            catch (Exception ex) { logger.LogError(ex, "Logistics automation check failed; persisted delivery and allocation states retained"); }
        } while (await timer.WaitForNextTickAsync(stoppingToken));
    }
}
