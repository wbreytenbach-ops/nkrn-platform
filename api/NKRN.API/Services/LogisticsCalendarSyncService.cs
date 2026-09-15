using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using NKRN.API.Data;
namespace NKRN.API.Services;

public class LogisticsCalendarSyncService(ApplicationDbContext db, GoogleCalendarService calendar,
    IOptions<LogisticsAutomationOptions> options, IHostEnvironment environment, ILogger<LogisticsCalendarSyncService> logger)
{
    public async Task<bool> SyncAsync(int id)
    {
        if (!options.Value.SyncCalendar || (environment.IsDevelopment() && !options.Value.RunInDevelopment)) return false;
        // Persist the event key before any external call. GUID hex satisfies Google's base32hex ID alphabet.
        await db.LogisticsWorkPlanItems.Where(i => i.WorkPlanItemID == id && i.CalendarEventID == null)
            .ExecuteUpdateAsync(set => set.SetProperty(i => i.CalendarEventID, "nkrn" + Guid.NewGuid().ToString("N")));
        await using var transaction = await db.Database.BeginTransactionAsync();
        await db.Database.ExecuteSqlInterpolatedAsync($"DECLARE @r int; EXEC @r = sp_getapplock @Resource={"NKRN:Logistics:calendar:" + id}, @LockMode='Exclusive', @LockOwner='Transaction', @LockTimeout=30000; IF @r < 0 THROW 51000, 'Could not lock calendar allocation', 1;");
        // Lock the row so an allocation edit cannot be overwritten by a stale sync result.
        var item = await db.LogisticsWorkPlanItems.FromSqlInterpolated($"SELECT * FROM LogisticsWorkPlanItems WITH (UPDLOCK, ROWLOCK) WHERE WorkPlanItemID = {id}").SingleAsync();
        await db.Entry(item).ReloadAsync();
        var worker = item.WorkerID == null ? null : await db.LogisticsWorkers.AsNoTracking().SingleOrDefaultAsync(w => w.WorkerID == item.WorkerID);
        try
        {
            await calendar.UpsertLogisticsEventAsync(options.Value.CalendarUserId, item.CalendarEventID!, item,
                worker == null ? "Nie toegeken nie" : $"{worker.FirstName} {worker.LastName}".Trim());
            item.CalendarSyncStatus = item.Status is "Cancelled" or "Gekanselleer" ? "Cancelled" : "Synced";
            item.CalendarSyncError = null;
            item.CalendarSyncedAt = DateTime.UtcNow;
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Logistics calendar sync failed for allocation {AllocationID}", id);
            item.CalendarSyncStatus = "Failed";
            item.CalendarSyncError = "Kalendersinkronisering het misluk. Probeer weer of kontroleer die bedienerlog.";
        }
        await db.SaveChangesAsync();
        await transaction.CommitAsync();
        return item.CalendarSyncStatus != "Failed";
    }
}
