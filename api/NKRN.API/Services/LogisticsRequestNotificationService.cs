using System.Data;
using System.Net;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using NKRN.API.Data;
using NKRN.API.Models;

namespace NKRN.API.Services;

public class LogisticsRequestNotificationService(
    ApplicationDbContext context, EmailService email,
    IConfiguration configuration, IWebHostEnvironment environment,
    ILogger<LogisticsRequestNotificationService> logger)
{
    public async Task NotifyAsync(LogisticsRequestResponse request, bool created = false, string? eventHeading = null)
    {
        if (environment.IsDevelopment() && !configuration.GetValue<bool>("Logistics:SendRequestEmailInDevelopment")) return;
        try
        {
            var admins = await context.Users.AsNoTracking()
                .Where(u => u.IsActive && u.RoleID == 3).Select(u => u.Email).ToListAsync();
            var recipients = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            foreach (var address in admins.Concat(new[] { request.RequestedByEmail,
                configuration["Logistics:ManagerEmail"] ?? "mcarnie@tygies.co.za" }))
                if (!string.IsNullOrWhiteSpace(address)) recipients.Add(address.Trim());
            var heading = eventHeading ?? (created ? "Logistics: Versoek ontvang / Request received" : "Logistics: Status verander / Status updated");
            var body = created
                ? BuildRequestEmailBody(request, request.RequestedByName, "", request.RequestedByEmail, heading)
                : $"<html><body><h2>{WebUtility.HtmlEncode(heading)}</h2><p>#{request.RequestID}: {WebUtility.HtmlEncode(request.Title)}</p><p>Status: {WebUtility.HtmlEncode(LogisticsWorkflow.StatusLabel(request.Status))}</p><p>Prioriteit / Priority: {WebUtility.HtmlEncode(LogisticsWorkflow.PriorityLabel(request.Priority))}</p><p>Bekyk die besonderhede en kommentaar in die portaal / View details and comments in the portal.</p></body></html>";
            foreach (var recipient in recipients)
            {
                try { await email.SendEmailAsync(recipient, $"{heading} #{request.RequestID}", body); }
                catch (Exception ex) { logger.LogError(ex, "Logistics request {RequestID}: notification failed for {Recipient}", request.RequestID, recipient); }
            }
        }
        catch (Exception ex) { logger.LogError(ex, "Logistics request {RequestID}: notification preparation failed", request.RequestID); }
    }

    public async Task<List<int>> SynchronizeTaskAsync(int taskID, string status)
    {
        var requestStatus = status.Trim().ToLowerInvariant() switch {
            "afgehandel" or "completed" or "done" => "Completed",
            "nog nie begin" or "logged" => "New",
            _ => "Under Review"
        };
        var connection = context.Database.GetDbConnection();
        await using var command = connection.CreateCommand();
        command.Transaction = context.Database.CurrentTransaction?.GetDbTransaction();
        command.CommandText = """
            UPDATE dbo.LogisticsRequests SET Status=@status, UpdatedDate=SYSDATETIME()
            OUTPUT INSERTED.RequestID
            WHERE ConvertedTaskID=@taskID AND IsDeleted=0 AND Status<>@status AND Status NOT IN ('Cancelled','Declined');
            """;
        foreach(var (name,value) in new (string,object)[]{("@status",requestStatus),("@taskID",taskID)}) {
            var p=command.CreateParameter(); p.ParameterName=name; p.Value=value; command.Parameters.Add(p);
        }
        var changed=new List<int>();
        await using var reader=await command.ExecuteReaderAsync();
        while(await reader.ReadAsync()) changed.Add(reader.GetInt32(0));
        return changed;
    }

    public async Task NotifyByIDAsync(int id, string? eventHeading = null)
    {
        // Called after the business transaction is committed and disposed.
        try
        {
            var connection = context.Database.GetDbConnection();
            var close = connection.State != ConnectionState.Open;
            if (close) await connection.OpenAsync();
            LogisticsRequestResponse? request = null;
            try
            {
                await using var command = connection.CreateCommand();
                command.CommandText = """
                    SELECT R.RequestID, R.Title, R.Description, R.Status, R.Priority,
                        COALESCE(U.FirstName, '') + ' ' + COALESCE(U.LastName, ''), COALESCE(U.Email, ''), R.RequestType
                    FROM dbo.LogisticsRequests R LEFT JOIN dbo.Users U ON U.UserID = R.RequestedByUserID
                    WHERE R.RequestID = @id AND R.IsDeleted = 0;
                    """;
                var parameter = command.CreateParameter(); parameter.ParameterName = "@id"; parameter.Value = id; command.Parameters.Add(parameter);
                await using var reader = await command.ExecuteReaderAsync();
                if (await reader.ReadAsync()) request = new LogisticsRequestResponse {
                    RequestID = reader.GetInt32(0), Title = reader.GetString(1), Description = reader.IsDBNull(2) ? null : reader.GetString(2),
                    Status = reader.GetString(3), Priority = reader.GetString(4), RequestedByName = reader.GetString(5),
                    RequestedByEmail = reader.GetString(6), RequestType = reader.GetString(7)
                };
            }
            finally { if (close) await connection.CloseAsync(); }
            if (request != null) await NotifyAsync(request, eventHeading: eventHeading);
        }
        catch (Exception ex) { logger.LogError(ex, "Logistics request {RequestID}: status notification failed", id); }
    }
        private static string BuildRequestEmailBody(
            LogisticsRequestResponse request,
            string firstName,
            string lastName,
            string requesterEmail, string heading)
        {
            static string E(string? value) =>
                WebUtility.HtmlEncode(
                    value ?? string.Empty);

            var location =
                request.Locations
                    .OrderByDescending(item =>
                        item.IsPrimary)
                    .Select(item =>
                        item.LocationName ??
                        item.LocationText)
                    .FirstOrDefault(value =>
                        !string.IsNullOrWhiteSpace(
                            value))
                ?? "Nie gespesifiseer nie";

            var equipment =
                request.Equipment.Count == 0
                    ? "Geen"
                    : string.Join(
                        ", ",
                        request.Equipment.Select(
                            item =>
                                item.EquipmentName));

            var maintenance =
                request.MaintenanceItems.Count == 0
                    ? "Nie van toepassing nie"
                    : string.Join(
                        ", ",
                        request.MaintenanceItems.Select(
                            item =>
                                $"{item.MaintenanceName} ({item.ActionType})"));

            var when =
                request.ActivityDate.HasValue
                    ? request.ActivityDate.Value
                        .ToString("yyyy-MM-dd")
                    : "Nie van toepassing nie";

            if (request.StartTime.HasValue &&
                request.EndTime.HasValue)
            {
                when +=
                    $" {request.StartTime.Value:hh\\:mm}–{request.EndTime.Value:hh\\:mm}";
            }

            return $"""
                <html>
                <body style="font-family:Arial,sans-serif;color:#222;">
                    <h2>{E(heading)}</h2>

                    <p><strong>Versoek:</strong> #{request.RequestID}</p>
                    <p><strong>Ingedien deur:</strong> {E($"{firstName} {lastName}".Trim())}</p>
                    <p><strong>E-pos:</strong> {E(requesterEmail)}</p>
                    <p><strong>Soort:</strong> {E(request.RequestType)}</p>
                    <p><strong>Kategorie:</strong> {E(request.ActivityCategory ?? "Nie van toepassing nie")}</p>
                    <p><strong>Opsomming:</strong> {E(request.Title)}</p>
                    <p><strong>Besonderhede:</strong><br />{E(request.Description)}</p>
                    <p><strong>Ligging:</strong> {E(location)}</p>
                    <p><strong>Datum / tyd:</strong> {E(when)}</p>
                    <p><strong>Toerusting:</strong> {E(equipment)}</p>
                    <p><strong>Instandhouding:</strong> {E(maintenance)}</p>
                    <p><strong>Status:</strong> {E(LogisticsWorkflow.StatusLabel(request.Status))}</p>
                    <p><strong>Prioriteit:</strong> {E(LogisticsWorkflow.PriorityLabel(request.Priority))}</p>
                </body>
                </html>
                """;
        }

}
