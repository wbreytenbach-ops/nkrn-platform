using System.Data;
using System.Net;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using NKRN.API.Data;
using NKRN.API.Models;

namespace NKRN.API.Services;

public class LogisticsRequestNotificationService(
    ApplicationDbContext context,
    EmailService email,
    IConfiguration configuration,
    IWebHostEnvironment environment,
    ILogger<LogisticsRequestNotificationService> logger)
{
    private static readonly string[] DefaultRecipients =
    {
        "logistiek@tygies.co.za",
        "terreinbestuur@tygies.co.za"
    };

    public async Task NotifyAsync(
        LogisticsRequestResponse request,
        bool created = false,
        string? eventHeading = null)
    {
        if (environment.IsDevelopment() &&
            !configuration.GetValue<bool>("Logistics:SendRequestEmailInDevelopment"))
        {
            return;
        }

        try
        {
            var recipients = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

            if (!string.IsNullOrWhiteSpace(request.RequestedByEmail))
            {
                recipients.Add(request.RequestedByEmail.Trim());
            }

            foreach (var address in DefaultRecipients)
            {
                if (!string.IsNullOrWhiteSpace(address))
                {
                    recipients.Add(address.Trim());
                }
            }

            var heading = eventHeading ??
                (created
                    ? "Logistieke versoek ontvang"
                    : "Logistieke versoek opgedateer");

            var body = BuildEmailBody(request, heading, created);

            foreach (var recipient in recipients)
            {
                try
                {
                    await email.SendEmailAsync(
                        recipient,
                        $"{heading} #{request.RequestID}",
                        body);
                }
                catch (Exception ex)
                {
                    logger.LogError(
                        ex,
                        "Logistics request {RequestID}: notification failed for {Recipient}",
                        request.RequestID,
                        recipient);
                }
            }
        }
        catch (Exception ex)
        {
            logger.LogError(
                ex,
                "Logistics request {RequestID}: notification preparation failed",
                request.RequestID);
        }
    }

    public async Task<List<int>> SynchronizeTaskAsync(int taskID, string status)
    {
        var requestStatus =
            NkrnRequestRules.NormaliseRequestStatus(status);

        var connection = context.Database.GetDbConnection();

        await using var command = connection.CreateCommand();
        command.Transaction = context.Database.CurrentTransaction?.GetDbTransaction();
        command.CommandText = """
            UPDATE dbo.LogisticsRequests
            SET Status=@status, UpdatedDate=SYSDATETIME()
            OUTPUT INSERTED.RequestID
            WHERE ConvertedTaskID=@taskID
              AND IsDeleted=0
              AND Status<>@status
              AND Status NOT IN ('Cancelled','Declined');
            """;

        foreach (var (name, value) in new (string, object)[]
        {
            ("@status", requestStatus),
            ("@taskID", taskID)
        })
        {
            var parameter = command.CreateParameter();
            parameter.ParameterName = name;
            parameter.Value = value;
            command.Parameters.Add(parameter);
        }

        var changed = new List<int>();

        await using var reader = await command.ExecuteReaderAsync();

        while (await reader.ReadAsync())
        {
            changed.Add(reader.GetInt32(0));
        }

        return changed;
    }

    public async Task NotifyByIDAsync(
        int id,
        string? eventHeading = null)
    {
        try
        {
            var connection = context.Database.GetDbConnection();
            var close = connection.State != ConnectionState.Open;

            if (close)
            {
                await connection.OpenAsync();
            }

            LogisticsRequestResponse? request = null;

            try
            {
                await using var command = connection.CreateCommand();
                command.CommandText = """
                    SELECT
                        R.RequestID,
                        R.Title,
                        R.Description,
                        R.Status,
                        R.Priority,
                        COALESCE(U.FirstName, '') + ' ' + COALESCE(U.LastName, ''),
                        COALESCE(U.Email, ''),
                        R.RequestType,
                        R.ActivityCategory
                    FROM dbo.LogisticsRequests R
                    LEFT JOIN dbo.Users U ON U.UserID = R.RequestedByUserID
                    WHERE R.RequestID = @id AND R.IsDeleted = 0;
                    """;

                var parameter = command.CreateParameter();
                parameter.ParameterName = "@id";
                parameter.Value = id;
                command.Parameters.Add(parameter);

                await using var reader = await command.ExecuteReaderAsync();

                if (await reader.ReadAsync())
                {
                    request = new LogisticsRequestResponse
                    {
                        RequestID = reader.GetInt32(0),
                        Title = reader.GetString(1),
                        Description = reader.IsDBNull(2) ? null : reader.GetString(2),
                        Status = reader.GetString(3),
                        Priority = reader.GetString(4),
                        RequestedByName = reader.GetString(5),
                        RequestedByEmail = reader.GetString(6),
                        RequestType = reader.GetString(7),
                        ActivityCategory = reader.IsDBNull(8) ? null : reader.GetString(8)
                    };
                }
            }
            finally
            {
                if (close)
                {
                    await connection.CloseAsync();
                }
            }

            if (request != null)
            {
                await NotifyAsync(request, eventHeading: eventHeading);
            }
        }
        catch (Exception ex)
        {
            logger.LogError(
                ex,
                "Logistics request {RequestID}: status notification failed",
                id);
        }
    }

    private static string BuildEmailBody(
        LogisticsRequestResponse request,
        string heading,
        bool created)
    {
        static string E(string? value) =>
            WebUtility.HtmlEncode(value ?? string.Empty);

        var location = request.Locations
            .OrderByDescending(item => item.IsPrimary)
            .Select(item => item.LocationName ?? item.LocationText)
            .FirstOrDefault(value => !string.IsNullOrWhiteSpace(value))
            ?? "Nie gespesifiseer nie";

        var intro = created
            ? "Die versoek is suksesvol aangemeld."
            : "Die versoek se status of prioriteit is opgedateer.";

        return $"""
            <html>
            <body style="font-family:Arial,sans-serif;color:#222;">
                <h2>{E(heading)}</h2>
                <p>{E(intro)}</p>
                <p><strong>Versoek:</strong> #{request.RequestID}</p>
                <p><strong>Ingedien deur:</strong> {E(request.RequestedByName)}</p>
                <p><strong>Soort:</strong> {E(request.RequestType)}</p>
                <p><strong>Kategorie:</strong> {E(request.ActivityCategory ?? "Nie van toepassing nie")}</p>
                <p><strong>Opsomming:</strong> {E(request.Title)}</p>
                <p><strong>Besonderhede:</strong><br />{E(request.Description)}</p>
                <p><strong>Ligging:</strong> {E(location)}</p>
                <p><strong>Status:</strong> {E(LogisticsWorkflow.StatusLabel(request.Status))}</p>
                <p><strong>Prioriteit:</strong> {E(LogisticsWorkflow.PriorityLabel(request.Priority))}</p>
                <p>Meld by die NKRN-portaal aan om die versoek te besigtig of op te dateer.</p>
            </body>
            </html>
            """;
    }
}
