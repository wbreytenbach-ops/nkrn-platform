using System.Data;
using System.Data.Common;
using System.Net;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using NKRN.API.Data;
using NKRN.API.Models;

namespace NKRN.API.Services;

public sealed class LogisticsReminderService
{
    private readonly ApplicationDbContext _context;
    private readonly EmailService _emailService;
    private readonly IOptionsMonitor<LogisticsReminderOptions> _options;
    private readonly ILogger<LogisticsReminderService> _logger;

    public LogisticsReminderService(
        ApplicationDbContext context,
        EmailService emailService,
        IOptionsMonitor<LogisticsReminderOptions> options,
        ILogger<LogisticsReminderService> logger)
    {
        _context = context;
        _emailService = emailService;
        _options = options;
        _logger = logger;
    }

    public sealed record DueReminder(
        int RequestID,
        int RequestedByUserID,
        string RequestedByName,
        string RequestedByEmail,
        string Title,
        DateTime ActivityDate,
        TimeSpan? StartTime,
        TimeSpan? EndTime,
        string Status,
        string Priority,
        string Location,
        string Equipment,
        bool? CleanupNextDay,
        string ReminderType,
        int DaysUntil);

    public sealed record ReminderRunResult(
        int DueRequests,
        int AttemptedDeliveries,
        int SentDeliveries,
        int FailedDeliveries);

    public static string? ReminderTypeFor(
        DateTime today,
        DateTime activityDate)
    {
        var days = (activityDate.Date - today.Date).Days;

        return days switch
        {
            7 => "7D",
            1 => "1D",
            _ => null
        };
    }

    public async Task<List<DueReminder>> PreviewDueAsync(
        DateTime today,
        CancellationToken cancellationToken = default)
    {
        var output = new List<DueReminder>();

        var connection = _context.Database.GetDbConnection();
        var shouldClose = connection.State != ConnectionState.Open;

        if (shouldClose)
        {
            await connection.OpenAsync(cancellationToken);
        }

        try
        {
            await using var command = connection.CreateCommand();

            command.CommandText = """
                SELECT
                    R.RequestID,
                    R.RequestedByUserID,
                    LTRIM(RTRIM(
                        COALESCE(U.FirstName, '') + ' ' +
                        COALESCE(U.LastName, '')
                    )) AS RequestedByName,
                    COALESCE(U.Email, '') AS RequestedByEmail,
                    R.Title,
                    R.ActivityDate,
                    R.StartTime,
                    R.EndTime,
                    R.Status,
                    R.Priority,
                    COALESCE(LocationInfo.LocationDisplay, 'Nie gespesifiseer nie') AS LocationDisplay,
                    COALESCE(EquipmentInfo.EquipmentDisplay, 'Geen') AS EquipmentDisplay,
                    R.CleanupNextDay
                FROM dbo.LogisticsRequests R
                LEFT JOIN dbo.Users U
                    ON U.UserID = R.RequestedByUserID
                OUTER APPLY
                (
                    SELECT TOP (1)
                        COALESCE(
                            L.LocationName,
                            RL.LocationText,
                            'Nie gespesifiseer nie'
                        ) AS LocationDisplay
                    FROM dbo.LogisticsRequestLocations RL
                    LEFT JOIN dbo.Locations L
                        ON L.LocationID = RL.LocationID
                    WHERE RL.RequestID = R.RequestID
                    ORDER BY
                        RL.IsPrimary DESC,
                        RL.RequestLocationID
                ) LocationInfo
                OUTER APPLY
                (
                    SELECT
                        STUFF
                        (
                            (
                                SELECT
                                    ', ' + ET.EquipmentName +
                                    CASE
                                        WHEN RE.Quantity IS NULL
                                            THEN ''
                                        ELSE ' x ' + CONVERT(varchar(12), RE.Quantity)
                                    END
                                FROM dbo.LogisticsRequestEquipment RE
                                INNER JOIN dbo.LogisticsEquipmentTypes ET
                                    ON ET.EquipmentTypeID = RE.EquipmentTypeID
                                WHERE RE.RequestID = R.RequestID
                                ORDER BY ET.DisplayOrder, ET.EquipmentName
                                FOR XML PATH(''), TYPE
                            ).value('.', 'nvarchar(max)'),
                            1,
                            2,
                            ''
                        ) AS EquipmentDisplay
                ) EquipmentInfo
                WHERE
                    R.IsDeleted = 0
                    AND R.RequestType = 'Event'
                    AND R.ActivityDate IS NOT NULL
                    AND
                    (
                        CAST(R.ActivityDate AS date) = DATEADD(day, 7, CAST(@Today AS date))
                        OR
                        CAST(R.ActivityDate AS date) = DATEADD(day, 1, CAST(@Today AS date))
                    )
                    AND R.Status NOT IN
                    (
                        'Done',
                        'Completed',
                        'Cancelled',
                        'Declined'
                    )
                ORDER BY
                    R.ActivityDate,
                    R.RequestID;
                """;

            AddParameter(command, "@Today", today.Date);

            await using var reader =
                await command.ExecuteReaderAsync(cancellationToken);

            while (await reader.ReadAsync(cancellationToken))
            {
                var activityDate = reader.GetDateTime(5);
                var reminderType =
                    ReminderTypeFor(today, activityDate);

                if (reminderType == null)
                {
                    continue;
                }

                output.Add(
                    new DueReminder(
                        reader.GetInt32(0),
                        reader.GetInt32(1),
                        reader.GetString(2),
                        reader.GetString(3),
                        reader.GetString(4),
                        activityDate,
                        reader.IsDBNull(6)
                            ? null
                            : reader.GetFieldValue<TimeSpan>(6),
                        reader.IsDBNull(7)
                            ? null
                            : reader.GetFieldValue<TimeSpan>(7),
                        reader.GetString(8),
                        reader.GetString(9),
                        reader.GetString(10),
                        reader.GetString(11),
                        reader.IsDBNull(12)
                            ? null
                            : reader.GetBoolean(12),
                        reminderType,
                        (activityDate.Date - today.Date).Days
                    )
                );
            }
        }
        finally
        {
            if (shouldClose &&
                connection.State == ConnectionState.Open)
            {
                await connection.CloseAsync();
            }
        }

        return output;
    }

    public async Task<ReminderRunResult> SendDueAsync(
        DateTime today,
        CancellationToken cancellationToken = default)
    {
        var due = await PreviewDueAsync(
            today,
            cancellationToken);

        var attempted = 0;
        var sent = 0;
        var failed = 0;

        foreach (var request in due)
        {
            var recipients =
                BuildRecipients(
                    request.RequestedByEmail);

            foreach (var recipient in recipients)
            {
                if (await AlreadySentAsync(
                    request.RequestID,
                    request.ReminderType,
                    recipient,
                    cancellationToken))
                {
                    continue;
                }

                attempted++;

                try
                {
                    await MarkAttemptAsync(
                        request.RequestID,
                        request.ReminderType,
                        recipient,
                        cancellationToken);

                    var subject =
                        request.ReminderType == "1D"
                            ? $"Herinnering: {request.Title} is môre"
                            : $"Herinnering: {request.Title} is oor 7 dae";

                    await _emailService.SendEmailAsync(
                        recipient,
                        subject,
                        BuildEmailBody(request));

                    await MarkSentAsync(
                        request.RequestID,
                        request.ReminderType,
                        recipient,
                        cancellationToken);

                    sent++;
                }
                catch (Exception ex)
                {
                    failed++;

                    _logger.LogError(
                        ex,
                        "Logistics reminder {ReminderType} for request {RequestID} failed for {Recipient}.",
                        request.ReminderType,
                        request.RequestID,
                        recipient);

                    try
                    {
                        await MarkFailedAsync(
                            request.RequestID,
                            request.ReminderType,
                            recipient,
                            ex.Message,
                            cancellationToken);
                    }
                    catch (Exception logEx)
                    {
                        _logger.LogWarning(
                            logEx,
                            "Unable to record Logistics reminder failure.");
                    }
                }
            }
        }

        return new ReminderRunResult(
            due.Count,
            attempted,
            sent,
            failed);
    }

    private HashSet<string> BuildRecipients(
        string requesterEmail)
    {
        var recipients =
            new HashSet<string>(
                StringComparer.OrdinalIgnoreCase);

        if (!string.IsNullOrWhiteSpace(requesterEmail))
        {
            recipients.Add(
                requesterEmail.Trim());
        }

        var configured =
            _options.CurrentValue.RecipientEmails ??
            Array.Empty<string>();

        foreach (var email in configured.Concat(
            new[]
            {
                "terreinbestuur@tygies.co.za",
                "logistiek@tygies.co.za",
                "msmit@tygies.co.za"
            }))
        {
            if (!string.IsNullOrWhiteSpace(email))
            {
                recipients.Add(email.Trim());
            }
        }

        return recipients;
    }

    private async Task<bool> AlreadySentAsync(
        int requestID,
        string reminderType,
        string recipient,
        CancellationToken cancellationToken)
    {
        var connection =
            _context.Database.GetDbConnection();

        var shouldClose =
            connection.State != ConnectionState.Open;

        if (shouldClose)
        {
            await connection.OpenAsync(cancellationToken);
        }

        try
        {
            await using var command =
                connection.CreateCommand();

            command.CommandText = """
                SELECT COUNT(*)
                FROM dbo.LogisticsRequestReminderDeliveries
                WHERE
                    RequestID = @RequestID
                    AND ReminderType = @ReminderType
                    AND RecipientEmail = @RecipientEmail
                    AND Status = 'Sent';
                """;

            AddParameter(command, "@RequestID", requestID);
            AddParameter(command, "@ReminderType", reminderType);
            AddParameter(command, "@RecipientEmail", recipient);

            return Convert.ToInt32(
                await command.ExecuteScalarAsync(
                    cancellationToken)) > 0;
        }
        finally
        {
            if (shouldClose &&
                connection.State == ConnectionState.Open)
            {
                await connection.CloseAsync();
            }
        }
    }

    private Task MarkAttemptAsync(
        int requestID,
        string reminderType,
        string recipient,
        CancellationToken cancellationToken) =>
        ExecuteDeliveryUpsertAsync(
            requestID,
            reminderType,
            recipient,
            "Sending",
            null,
            cancellationToken);

    private Task MarkSentAsync(
        int requestID,
        string reminderType,
        string recipient,
        CancellationToken cancellationToken) =>
        ExecuteDeliveryUpsertAsync(
            requestID,
            reminderType,
            recipient,
            "Sent",
            null,
            cancellationToken);

    private Task MarkFailedAsync(
        int requestID,
        string reminderType,
        string recipient,
        string error,
        CancellationToken cancellationToken) =>
        ExecuteDeliveryUpsertAsync(
            requestID,
            reminderType,
            recipient,
            "Failed",
            error,
            cancellationToken);

    private async Task ExecuteDeliveryUpsertAsync(
        int requestID,
        string reminderType,
        string recipient,
        string status,
        string? error,
        CancellationToken cancellationToken)
    {
        var connection =
            _context.Database.GetDbConnection();

        var shouldClose =
            connection.State != ConnectionState.Open;

        if (shouldClose)
        {
            await connection.OpenAsync(cancellationToken);
        }

        try
        {
            await using var command =
                connection.CreateCommand();

            command.CommandText = """
                IF EXISTS
                (
                    SELECT 1
                    FROM dbo.LogisticsRequestReminderDeliveries
                    WHERE
                        RequestID = @RequestID
                        AND ReminderType = @ReminderType
                        AND RecipientEmail = @RecipientEmail
                )
                BEGIN
                    UPDATE dbo.LogisticsRequestReminderDeliveries
                    SET
                        Status = @Status,
                        AttemptCount =
                            CASE
                                WHEN @Status = 'Sending'
                                    THEN AttemptCount + 1
                                ELSE AttemptCount
                            END,
                        LastAttemptAt = SYSUTCDATETIME(),
                        SentAt =
                            CASE
                                WHEN @Status = 'Sent'
                                    THEN SYSUTCDATETIME()
                                ELSE SentAt
                            END,
                        ErrorMessage = @ErrorMessage
                    WHERE
                        RequestID = @RequestID
                        AND ReminderType = @ReminderType
                        AND RecipientEmail = @RecipientEmail;
                END
                ELSE
                BEGIN
                    INSERT INTO dbo.LogisticsRequestReminderDeliveries
                    (
                        RequestID,
                        ReminderType,
                        RecipientEmail,
                        Status,
                        AttemptCount,
                        LastAttemptAt,
                        SentAt,
                        ErrorMessage
                    )
                    VALUES
                    (
                        @RequestID,
                        @ReminderType,
                        @RecipientEmail,
                        @Status,
                        CASE WHEN @Status = 'Sending' THEN 1 ELSE 0 END,
                        SYSUTCDATETIME(),
                        CASE WHEN @Status = 'Sent'
                            THEN SYSUTCDATETIME()
                            ELSE NULL
                        END,
                        @ErrorMessage
                    );
                END;
                """;

            AddParameter(command, "@RequestID", requestID);
            AddParameter(command, "@ReminderType", reminderType);
            AddParameter(command, "@RecipientEmail", recipient);
            AddParameter(command, "@Status", status);
            AddParameter(
                command,
                "@ErrorMessage",
                string.IsNullOrWhiteSpace(error)
                    ? null
                    : error.Length <= 1000
                        ? error
                        : error[..1000]);

            await command.ExecuteNonQueryAsync(
                cancellationToken);
        }
        finally
        {
            if (shouldClose &&
                connection.State == ConnectionState.Open)
            {
                await connection.CloseAsync();
            }
        }
    }

    private static string BuildEmailBody(
        DueReminder request)
    {
        static string E(string? value) =>
            WebUtility.HtmlEncode(
                value ?? string.Empty);

        var when =
            request.ActivityDate.ToString(
                "dddd, dd MMMM yyyy",
                new System.Globalization.CultureInfo("af-ZA"));

        if (request.StartTime.HasValue)
        {
            when +=
                $" om {request.StartTime.Value:hh\\:mm}";
        }

        if (request.EndTime.HasValue)
        {
            when +=
                $"–{request.EndTime.Value:hh\\:mm}";
        }

        var reminderHeading =
            request.ReminderType == "1D"
                ? "Die funksie is môre."
                : "Die funksie is oor 7 dae.";

        var status =
            LogisticsWorkflow.StatusLabel(
                request.Status);

        var statusNote =
            NkrnRequestRules.NormaliseRequestStatus(
                request.Status) switch
            {
                "Logged" =>
                    "Die versoek is aangemeld en wag nog om hanteer te word.",
                "Busy" =>
                    "Die versoek word tans hanteer.",
                _ =>
                    $"Huidige status: {status}."
            };

        var cleanup =
            request.CleanupNextDay == true
                ? "Ja – skoonmaak die volgende dag is aangedui."
                : "Geen opvolgskoonmaak is aangedui nie.";

        return $"""
            <html>
            <body style="font-family:Arial,sans-serif;color:#222;">
                <h2>Logistieke funksieherinnering</h2>

                <p><strong>{E(reminderHeading)}</strong></p>

                <p><strong>Versoek:</strong> #{request.RequestID}</p>
                <p><strong>Funksie:</strong> {E(request.Title)}</p>
                <p><strong>Datum en tyd:</strong> {E(when)}</p>
                <p><strong>Ligging:</strong> {E(request.Location)}</p>
                <p><strong>Toerusting:</strong> {E(request.Equipment)}</p>
                <p><strong>Skoonmaak:</strong> {E(cleanup)}</p>
                <p><strong>Status:</strong> {E(status)}</p>
                <p><strong>Prioriteit:</strong> {E(LogisticsWorkflow.PriorityLabel(request.Priority))}</p>

                <p>{E(statusNote)}</p>

                <p>
                    Meld by die NKRN-portaal aan om die versoek,
                    kommentaar en vordering na te gaan.
                </p>
            </body>
            </html>
            """;
    }

    private static void AddParameter(
        DbCommand command,
        string name,
        object? value)
    {
        var parameter =
            command.CreateParameter();

        parameter.ParameterName = name;
        parameter.Value =
            value ?? DBNull.Value;

        command.Parameters.Add(parameter);
    }
}
