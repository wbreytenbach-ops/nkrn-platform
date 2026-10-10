using System.Data;
using System.Data.Common;
using System.Net;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NKRN.API.Data;
using NKRN.API.Models;
using NKRN.API.Services;

namespace NKRN.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class FunksieversorgingRequestsController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly EmailService _emailService;
    private readonly IConfiguration _configuration;
    private readonly IWebHostEnvironment _environment;
    private static readonly string[] DefaultNotificationEmails =
    {
        "svanwyk@tygies.co.za",
        "kultuur@tygies.co.za"
    };
    private readonly NkrnAiService _aiService;

    private static readonly HashSet<string> AllowedVenues =
        new(StringComparer.OrdinalIgnoreCase)
        {
            "Saal",
            "Panthera (losie bo)",
            "Panthera (onder)",
            "Klaskamers",
            "Personeelkamer",
            "Ander"
        };

    private static readonly IReadOnlyDictionary<string, InventoryDefinition> Inventory =
        new Dictionary<string, InventoryDefinition>(StringComparer.OrdinalIgnoreCase)
        {
            ["swart-tafeldoek"] = new("swart-tafeldoek", "Swart tafeldoeke", "Tafeldoeke", 15, false),
            ["tygerpoort-tafeldoek"] = new("tygerpoort-tafeldoek", "Tygerpoort tafeldoeke", "Tafeldoeke", 5, false),
            ["swart-spantafeldoek"] = new("swart-spantafeldoek", "Swart spantafeldoeke (bemarking)", "Tafeldoeke", 4, false),
            ["rooi-wit-tafeldoek"] = new("rooi-wit-tafeldoek", "Rooi-en-wit gestreepte tafeldoeke (bemarking)", "Tafeldoeke", 4, false),

            ["groot-borde-grys"] = new("groot-borde-grys", "Groot borde - grys", "Eetgerei", 200, true),
            ["kleinbordjies-grys"] = new("kleinbordjies-grys", "Kleinbordjies - grys", "Eetgerei", 200, true),
            ["bakkies-grys"] = new("bakkies-grys", "Sop-/poedingbakkies - grys", "Eetgerei", 200, true),
            ["groot-borde-wit"] = new("groot-borde-wit", "Groot borde - wit", "Eetgerei", 102, true),
            ["kleinbordjies-wit"] = new("kleinbordjies-wit", "Kleinbordjies - wit", "Eetgerei", 80, true),
            ["bakkies-wit"] = new("bakkies-wit", "Sop-/poedingbakkies - wit", "Eetgerei", 6, true),
            ["glase-gin"] = new("glase-gin", "Glase - gin", "Eetgerei", 20, true),
            ["glase-koeldrank"] = new("glase-koeldrank", "Glase - koeldrank", "Eetgerei", 200, true),
            ["glase-wyn"] = new("glase-wyn", "Glase - wyn", "Eetgerei", 200, true),
            ["pierings-wit"] = new("pierings-wit", "Pierings - wit", "Eetgerei", 150, true),
            ["koppies-wit"] = new("koppies-wit", "Koppies - wit", "Eetgerei", 150, true),
            ["messe-silwer"] = new("messe-silwer", "Messe - silwer", "Eetgerei", 157, true),
            ["vurke-silwer"] = new("vurke-silwer", "Vurke - silwer", "Eetgerei", 200, true),
            ["nagereglepels-silwer"] = new("nagereglepels-silwer", "Nagereglepels - silwer", "Eetgerei", 186, true),
            ["teelepels-silwer"] = new("teelepels-silwer", "Teelepels - silwer", "Eetgerei", 100, true),
            ["koffiebekers-wit"] = new("koffiebekers-wit", "Koffiebekers - wit", "Eetgerei", 80, true),
            ["koffiebekers-wapen"] = new("koffiebekers-wapen", "Koffiebekers met wapen - wit", "Eetgerei", 150, true),
            ["koffiebekers-grys"] = new("koffiebekers-grys", "Koffiebekers - grys", "Eetgerei", 200, true),

            ["bekers-sonder-wapen"] = new("bekers-sonder-wapen", "Bekers - sonder wapen", "Opdieningsvoorraad", 3, false),
            ["drukflesse-groot"] = new("drukflesse-groot", "Drukflesse groot - warm", "Opdieningsvoorraad", 2, false),
            ["drukflesse-klein"] = new("drukflesse-klein", "Drukflesse klein - warm", "Opdieningsvoorraad", 2, false),
            ["houtborde"] = new("houtborde", "Houtborde - uitpak", "Opdieningsvoorraad", 4, false),
            ["opskepskottels-silwer"] = new("opskepskottels-silwer", "Opskepbakke - silwer", "Opdieningsvoorraad", 3, false),
            ["opskepskottels-wit"] = new("opskepskottels-wit", "Opskepbakke - wit", "Opdieningsvoorraad", 4, false),
            ["opskeplepels"] = new("opskeplepels", "Opskeplepels - silwer", "Opdieningsvoorraad", 9, false),
            ["suikerpotte"] = new("suikerpotte", "Suikerpotte - wit", "Opdieningsvoorraad", 4, false),
            ["teeketels"] = new("teeketels", "Teeketels - staal", "Opdieningsvoorraad", 10, false),
            ["urn-warm"] = new("urn-warm", "Urn - warm", "Opdieningsvoorraad", 1, false),
            ["urn-koud"] = new("urn-koud", "Urn - koud", "Opdieningsvoorraad", 1, false),
            ["warmskinkborde"] = new("warmskinkborde", "Warmskinkborde / hot trays", "Opdieningsvoorraad", 3, false),
            ["yshouers"] = new("yshouers", "Yshouers / ysbakke", "Opdieningsvoorraad", 4, false),
            ["blompotte"] = new("blompotte", "Blompotte (slegs vir skoolgebruik)", "Opdieningsvoorraad", null, false)
        };

    public FunksieversorgingRequestsController(
        ApplicationDbContext context,
        EmailService emailService,
        IConfiguration configuration,
        IWebHostEnvironment environment,
        NkrnAiService aiService)
    {
        _context = context;
        _emailService = emailService;
        _configuration = configuration;
        _environment = environment;
        _aiService = aiService;
    }

    [HttpGet("access")]
    public async Task<ActionResult<object>> GetAccess()
    {
        var userID = GetLoggedInUserID();

        if (!userID.HasValue)
        {
            return Unauthorized();
        }

        return Ok(new
        {
            canManage = await CanManageAsync(userID.Value)
        });
    }

    [AllowAnonymous]
    [HttpGet("print/{requestID:int}")]
    public async Task<ActionResult<FunksieversorgingRequestResponse>> GetPrintableRequest(
        int requestID,
        [FromQuery] long expires,
        [FromQuery] string signature)
    {
        var now = DateTimeOffset.UtcNow.ToUnixTimeSeconds();

        if (expires < now ||
            expires > DateTimeOffset.UtcNow.AddDays(31).ToUnixTimeSeconds() ||
            !IsPrintSignatureValid(requestID, expires, signature))
        {
            return NotFound();
        }

        var request = (await LoadRequestsAsync(null, requestID))
            .FirstOrDefault(item => item.RequestID == requestID);

        if (request is null)
        {
            return NotFound();
        }

        return Ok(request);
    }

    [HttpGet("mine")]
    public async Task<ActionResult<IEnumerable<FunksieversorgingRequestResponse>>> GetMine()
    {
        var userID = GetLoggedInUserID();

        if (!userID.HasValue)
        {
            return Unauthorized();
        }

        return Ok(await LoadRequestsAsync(userID.Value));
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<FunksieversorgingRequestResponse>>> GetAll()
    {
        var userID = GetLoggedInUserID();

        if (!userID.HasValue)
        {
            return Unauthorized();
        }

        if (!await CanManageAsync(userID.Value))
        {
            return Forbid();
        }

        return Ok(await LoadRequestsAsync(null));
    }

    [HttpPost]
    public async Task<ActionResult<FunksieversorgingRequestResponse>> Create(
        [FromBody] CreateFunksieversorgingRequest request)
    {
        var userID = GetLoggedInUserID();

        if (!userID.HasValue)
        {
            return Unauthorized();
        }

        var requester = await _context.Users
            .AsNoTracking()
            .FirstOrDefaultAsync(u => u.UserID == userID.Value && u.IsActive);

        if (requester == null)
        {
            return Unauthorized();
        }

        var functionName = request.FunctionName?.Trim() ?? string.Empty;
        var venue = request.Venue?.Trim() ?? string.Empty;
        var otherVenue = request.OtherVenue?.Trim();
        var notes = request.Notes?.Trim();

        if (request.NeededDate.Date < DateTime.Today)
        {
            return BadRequest("Die datum kan nie in die verlede wees nie.");
        }

        if (string.IsNullOrWhiteSpace(functionName))
        {
            return BadRequest("Vul asseblief die funksie se naam in.");
        }

        if (!AllowedVenues.Contains(venue))
        {
            return BadRequest("Kies asseblief â€™n geldige lokaal.");
        }

        if (venue.Equals("Ander", StringComparison.OrdinalIgnoreCase) &&
            string.IsNullOrWhiteSpace(otherVenue))
        {
            return BadRequest("Vul asseblief die ander lokaal in.");
        }

        if (request.Attendance <= 0 || request.Attendance > 5000)
        {
            return BadRequest("Vul asseblief â€™n geldige aantal persone in.");
        }

        if (!request.ReturnAcknowledged)
        {
            return BadRequest("Bevestig asseblief die terugbesorgingsvoorwaardes.");
        }

        if (request.Items == null || request.Items.Count == 0)
        {
            return BadRequest("Kies asseblief minstens een voorraaditem.");
        }

        var resolvedItems = new List<ResolvedItem>();
        var seenCodes = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        foreach (var input in request.Items)
        {
            var code = input.Code?.Trim() ?? string.Empty;

            if (string.IsNullOrWhiteSpace(code) || !seenCodes.Add(code))
            {
                return BadRequest("Een van die voorraaditems is ongeldig of is meer as een keer gekies.");
            }

            if (code.Equals("ander", StringComparison.OrdinalIgnoreCase))
            {
                var customName = input.CustomName?.Trim() ?? string.Empty;

                if (string.IsNullOrWhiteSpace(customName))
                {
                    return BadRequest("Verduidelik wat onder 'Ander' benodig word.");
                }

                if (input.Quantity <= 0)
                {
                    return BadRequest("Voer 'n hoeveelheid vir die ander item in.");
                }

                resolvedItems.Add(new ResolvedItem(
                    "ander",
                    customName,
                    "Opdieningsvoorraad",
                    input.Quantity,
                    null,
                    false
                ));

                continue;
            }

            if (!Inventory.TryGetValue(code, out var definition))
            {
                return BadRequest($"Onbekende voorraaditem: {code}");
            }

            var quantity = definition.AttendanceDerived
                ? request.Attendance
                : input.Quantity;

            if (quantity <= 0)
            {
                return BadRequest($"Voer 'n hoeveelheid vir {definition.Name} in.");
            }

            resolvedItems.Add(new ResolvedItem(
                definition.Code,
                definition.Name,
                definition.Category,
                quantity,
                definition.Available,
                definition.AttendanceDerived
            ));
        }

        var leadTimeWarning =
            CountWorkingDays(DateTime.Today, request.NeededDate.Date) < 3;

        var aiAnalysis = await _aiService.AnalyseAsync(
            new AiTriageRequest
            {
                ModuleKey = "Funksieversorging",
                Description =
                    $"Funksie: {functionName}. " +
                    $"Lokaal: {(venue.Equals("Ander", StringComparison.OrdinalIgnoreCase) ? otherVenue : venue)}. " +
                    $"Aantal persone: {request.Attendance}. " +
                    $"Benodig teen: {request.NeededDate:yyyy-MM-dd}. " +
                    $"Notas: {notes ?? "Geen"}.",
                AdditionalContext =
                    $"Voorraaditems: {resolvedItems.Count}; " +
                    $"Kort kennisgewing: {(leadTimeWarning ? "Ja" : "Nee")}."
            },
            HttpContext.RequestAborted);

        var createdAt = DateTime.Now;
        int requestID;

        await _context.Database.OpenConnectionAsync();

        try
        {
            var connection = _context.Database.GetDbConnection();
            await using var transaction = await connection.BeginTransactionAsync();

            try
            {
                await using var insertRequest = connection.CreateCommand();
                insertRequest.Transaction = transaction;
                insertRequest.CommandText = """
                    INSERT INTO dbo.FunksieversorgingRequests
                    (
                        RequestedByUserID,
                        NeededDate,
                        FunctionName,
                        Venue,
                        OtherVenue,
                        Attendance,
                        Notes,
                        ReturnAcknowledged,
                        LeadTimeWarning,
                        Status,
                        CreatedAt
                    )
                    VALUES
                    (
                        @RequestedByUserID,
                        @NeededDate,
                        @FunctionName,
                        @Venue,
                        @OtherVenue,
                        @Attendance,
                        @Notes,
                        1,
                        @LeadTimeWarning,
                        'Logged',
                        @CreatedAt
                    );

                    SELECT CAST(SCOPE_IDENTITY() AS int);
                    """;

                AddParameter(insertRequest, "@RequestedByUserID", userID.Value);
                AddParameter(insertRequest, "@NeededDate", request.NeededDate.Date);
                AddParameter(insertRequest, "@FunctionName", functionName);
                AddParameter(insertRequest, "@Venue", venue);
                AddParameter(insertRequest, "@OtherVenue",
                    venue.Equals("Ander", StringComparison.OrdinalIgnoreCase)
                        ? otherVenue
                        : null);
                AddParameter(insertRequest, "@Attendance", request.Attendance);
                AddParameter(insertRequest, "@Notes",
                    string.IsNullOrWhiteSpace(notes) ? null : notes);
                AddParameter(insertRequest, "@LeadTimeWarning", leadTimeWarning);
                AddParameter(insertRequest, "@CreatedAt", createdAt);

                requestID = Convert.ToInt32(
                    await insertRequest.ExecuteScalarAsync()
                );

                foreach (var item in resolvedItems)
                {
                    await using var insertItem = connection.CreateCommand();
                    insertItem.Transaction = transaction;
                    insertItem.CommandText = """
                        INSERT INTO dbo.FunksieversorgingRequestItems
                        (
                            RequestID,
                            ItemCode,
                            ItemName,
                            Category,
                            RequestedQuantity,
                            RecordedAvailableQuantity,
                            IsAttendanceDerived
                        )
                        VALUES
                        (
                            @RequestID,
                            @ItemCode,
                            @ItemName,
                            @Category,
                            @RequestedQuantity,
                            @RecordedAvailableQuantity,
                            @IsAttendanceDerived
                        );
                        """;

                    AddParameter(insertItem, "@RequestID", requestID);
                    AddParameter(insertItem, "@ItemCode", item.Code);
                    AddParameter(insertItem, "@ItemName", item.Name);
                    AddParameter(insertItem, "@Category", item.Category);
                    AddParameter(insertItem, "@RequestedQuantity", item.Quantity);
                    AddParameter(insertItem, "@RecordedAvailableQuantity", item.Available);
                    AddParameter(insertItem, "@IsAttendanceDerived", item.AttendanceDerived);

                    await insertItem.ExecuteNonQueryAsync();
                }

                await transaction.CommitAsync();
            }
            catch
            {
                await transaction.RollbackAsync();
                throw;
            }
        }
        finally
        {
            await _context.Database.CloseConnectionAsync();
        }

        await _aiService.TryStoreAnalysisAsync(
            "Funksieversorging",
            requestID,
            aiAnalysis,
            HttpContext.RequestAborted);

        var notification = await TrySendNotificationAsync(
            requestID,
            requester.FirstName,
            requester.LastName,
            requester.Email,
            request.NeededDate.Date,
            functionName,
            venue.Equals("Ander", StringComparison.OrdinalIgnoreCase)
                ? otherVenue ?? "Ander"
                : venue,
            request.Attendance,
            notes,
            leadTimeWarning,
            resolvedItems
        );

        return Ok(new FunksieversorgingRequestResponse
        {
            RequestID = requestID,
            RequestedByUserID = requester.UserID,
            RequesterName = $"{requester.FirstName} {requester.LastName}".Trim(),
            RequesterEmail = requester.Email,
            NeededDate = request.NeededDate.Date,
            FunctionName = functionName,
            Venue = venue,
            OtherVenue = venue.Equals("Ander", StringComparison.OrdinalIgnoreCase)
                ? otherVenue
                : null,
            Attendance = request.Attendance,
            Notes = notes,
            ReturnAcknowledged = true,
            LeadTimeWarning = leadTimeWarning,
            Status = "Logged",
            CreatedAt = createdAt,
            NotificationSentAt = notification.SentAt,
            NotificationError = notification.Error,
            Items = resolvedItems.Select(item => new FunksieversorgingItemResponse
            {
                Code = item.Code,
                Name = item.Name,
                Category = item.Category,
                RequestedQuantity = item.Quantity,
                RecordedAvailableQuantity = item.Available,
                IsAttendanceDerived = item.AttendanceDerived
            }).ToList()
        });
    }

    public sealed class UpdateFunksieversorgingStatusRequest
    {
        public string Status { get; set; } = string.Empty;
    }

    [HttpPut("{id:int}/status")]
    public async Task<IActionResult> UpdateStatus(
        int id,
        [FromBody] UpdateFunksieversorgingStatusRequest input)
    {
        var userID =
            GetLoggedInUserID();

        if (!userID.HasValue)
        {
            return Unauthorized();
        }

        if (!await CanManageAsync(userID.Value))
        {
            return Forbid();
        }

        var status =
            input.Status?.Trim() ?? string.Empty;

        status =
            status.ToLowerInvariant() switch
            {
                "logged" => "Logged",
                "busy" or "inreview" or "in review" => "Busy",
                "done" => "Done",
                "declined" => "Declined",
                _ => string.Empty
            };

        if (string.IsNullOrWhiteSpace(status))
        {
            return BadRequest(new
            {
                message =
                    "Status moet Aangemeld, Besig, Afgehandel of Afgekeur wees."
            });
        }

        int requestedByUserID;
        DateTime neededDate;
        string functionName;
        string venue;

        await _context.Database.OpenConnectionAsync();

        try
        {
            var connection =
                _context.Database.GetDbConnection();

            await using var command =
                connection.CreateCommand();

            command.CommandText = """
                UPDATE dbo.FunksieversorgingRequests
                SET Status = @Status
                OUTPUT
                    INSERTED.RequestedByUserID,
                    INSERTED.NeededDate,
                    INSERTED.FunctionName,
                    CASE
                        WHEN INSERTED.Venue = 'Ander'
                            THEN COALESCE(INSERTED.OtherVenue, 'Ander')
                        ELSE INSERTED.Venue
                    END
                WHERE RequestID = @RequestID;
                """;

            AddParameter(
                command,
                "@Status",
                status);

            AddParameter(
                command,
                "@RequestID",
                id);

            await using var reader =
                await command.ExecuteReaderAsync();

            if (!await reader.ReadAsync())
            {
                return NotFound();
            }

            requestedByUserID =
                reader.GetInt32(0);

            neededDate =
                reader.GetDateTime(1);

            functionName =
                reader.GetString(2);

            venue =
                reader.GetString(3);
        }
        finally
        {
            await _context.Database.CloseConnectionAsync();
        }

        var requester =
            await _context.Users
                .AsNoTracking()
                .FirstOrDefaultAsync(
                    user =>
                        user.UserID ==
                            requestedByUserID);

        if (requester != null)
        {
            await SendStatusUpdateAsync(
                id,
                $"{requester.FirstName} {requester.LastName}".Trim(),
                requester.Email,
                neededDate,
                functionName,
                venue,
                status);
        }

        return NoContent();
    }
    private async Task<bool> CanManageAsync(int userID)
    {
        if (User.IsInRole("3"))
        {
            return true;
        }

        var userEmail = await _context.Users
            .AsNoTracking()
            .Where(user =>
                user.UserID == userID &&
                user.IsActive)
            .Select(user => user.Email)
            .FirstOrDefaultAsync();

        if (string.IsNullOrWhiteSpace(userEmail))
        {
            return false;
        }

        return GetNotificationEmails()
            .Contains(
                userEmail.Trim(),
                StringComparer.OrdinalIgnoreCase);
    }

    private List<string> GetNotificationEmails()
    {
        var recipients =
            new HashSet<string>(
                StringComparer.OrdinalIgnoreCase);

        var configured =
            _configuration
                .GetSection("Funksieversorging:NotificationEmails")
                .Get<string[]>();

        if (configured != null)
        {
            foreach (var address in configured)
            {
                if (!string.IsNullOrWhiteSpace(address))
                {
                    recipients.Add(address.Trim());
                }
            }
        }

        // Backward compatibility with the older single-address setting.
        var legacy =
            _configuration[
                "Funksieversorging:NotificationEmail"]
                ?.Trim();

        if (!string.IsNullOrWhiteSpace(legacy))
        {
            recipients.Add(legacy);
        }

        foreach (var address in DefaultNotificationEmails)
        {
            recipients.Add(address);
        }

        return recipients.ToList();
    }

    private HashSet<string> GetNotificationRecipients(
        string? requesterEmail)
    {
        var recipients =
            new HashSet<string>(
                GetNotificationEmails(),
                StringComparer.OrdinalIgnoreCase);

        if (!string.IsNullOrWhiteSpace(requesterEmail))
        {
            recipients.Add(requesterEmail.Trim());
        }

        return recipients;
    }

    private async Task<List<FunksieversorgingRequestResponse>> LoadRequestsAsync(
        int? requestedByUserID,
        int? requestID = null)
    {
        var results = new List<FunksieversorgingRequestResponse>();

        await _context.Database.OpenConnectionAsync();

        try
        {
            var connection = _context.Database.GetDbConnection();

            await using var command = connection.CreateCommand();

            command.CommandText = requestedByUserID.HasValue
                ? """
                    SELECT TOP (100)
                        R.RequestID,
                        R.RequestedByUserID,
                        U.FirstName,
                        U.LastName,
                        U.Email,
                        R.NeededDate,
                        R.FunctionName,
                        R.Venue,
                        R.OtherVenue,
                        R.Attendance,
                        R.Notes,
                        R.ReturnAcknowledged,
                        R.LeadTimeWarning,
                        R.Status,
                        R.CreatedAt,
                        R.NotificationSentAt,
                        R.NotificationError
                    FROM dbo.FunksieversorgingRequests R
                    INNER JOIN dbo.Users U
                        ON U.UserID = R.RequestedByUserID
                    WHERE R.RequestedByUserID = @RequestedByUserID
                    ORDER BY R.CreatedAt DESC, R.RequestID DESC;
                    """
                : """
                    SELECT TOP (100)
                        R.RequestID,
                        R.RequestedByUserID,
                        U.FirstName,
                        U.LastName,
                        U.Email,
                        R.NeededDate,
                        R.FunctionName,
                        R.Venue,
                        R.OtherVenue,
                        R.Attendance,
                        R.Notes,
                        R.ReturnAcknowledged,
                        R.LeadTimeWarning,
                        R.Status,
                        R.CreatedAt,
                        R.NotificationSentAt,
                        R.NotificationError
                    FROM dbo.FunksieversorgingRequests R
                    INNER JOIN dbo.Users U
                        ON U.UserID = R.RequestedByUserID
                    WHERE (@RequestID IS NULL OR R.RequestID = @RequestID)
                    ORDER BY R.CreatedAt DESC, R.RequestID DESC;
                    """;

            if (requestedByUserID.HasValue)
            {
                AddParameter(command, "@RequestedByUserID", requestedByUserID.Value);
            }

            if (!requestedByUserID.HasValue)
            {
                AddParameter(command, "@RequestID", requestID);
            }

            await using var reader = await command.ExecuteReaderAsync();

            while (await reader.ReadAsync())
            {
                results.Add(new FunksieversorgingRequestResponse
                {
                    RequestID = reader.GetInt32(0),
                    RequestedByUserID = reader.GetInt32(1),
                    RequesterName = $"{reader.GetString(2)} {reader.GetString(3)}".Trim(),
                    RequesterEmail = reader.GetString(4),
                    NeededDate = reader.GetDateTime(5),
                    FunctionName = reader.GetString(6),
                    Venue = reader.GetString(7),
                    OtherVenue = reader.IsDBNull(8) ? null : reader.GetString(8),
                    Attendance = reader.GetInt32(9),
                    Notes = reader.IsDBNull(10) ? null : reader.GetString(10),
                    ReturnAcknowledged = reader.GetBoolean(11),
                    LeadTimeWarning = reader.GetBoolean(12),
                    Status = reader.GetString(13),
                    CreatedAt = reader.GetDateTime(14),
                    NotificationSentAt = reader.IsDBNull(15) ? null : reader.GetDateTime(15),
                    NotificationError = reader.IsDBNull(16) ? null : reader.GetString(16)
                });
            }

            await reader.CloseAsync();

            foreach (var result in results)
            {
                result.Items = await LoadItemsAsync(connection, result.RequestID);
            }
        }
        finally
        {
            await _context.Database.CloseConnectionAsync();
        }

        return results;
    }

    private static async Task<List<FunksieversorgingItemResponse>> LoadItemsAsync(
        DbConnection connection,
        int requestID)
    {
        var items = new List<FunksieversorgingItemResponse>();

        await using var command = connection.CreateCommand();
        command.CommandText = """
            SELECT
                ItemCode,
                ItemName,
                Category,
                RequestedQuantity,
                RecordedAvailableQuantity,
                IsAttendanceDerived
            FROM dbo.FunksieversorgingRequestItems
            WHERE RequestID = @RequestID
            ORDER BY Category, ItemName;
            """;

        AddParameter(command, "@RequestID", requestID);

        await using var reader = await command.ExecuteReaderAsync();

        while (await reader.ReadAsync())
        {
            items.Add(new FunksieversorgingItemResponse
            {
                Code = reader.GetString(0),
                Name = reader.GetString(1),
                Category = reader.GetString(2),
                RequestedQuantity = reader.GetInt32(3),
                RecordedAvailableQuantity = reader.IsDBNull(4)
                    ? null
                    : reader.GetInt32(4),
                IsAttendanceDerived = reader.GetBoolean(5)
            });
        }

        return items;
    }

    private string CreatePrintUrl(int requestID)
    {
        var expires = DateTimeOffset.UtcNow.AddDays(30).ToUnixTimeSeconds();
        var signature = CreatePrintSignature(requestID, expires);
        var baseUrl = (_configuration["PublicBaseUrl"] ?? "https://portal.tygies.co.za").TrimEnd('/');
        return $"{baseUrl}/Funksieversorging/print?requestID={requestID}&expires={expires}&signature={Uri.EscapeDataString(signature)}";
    }

    private string CreatePrintSignature(int requestID, long expires)
    {
        var configuredKey = _configuration["Jwt:Key"];
        if (string.IsNullOrWhiteSpace(configuredKey))
        {
            throw new InvalidOperationException("The configured signing key is unavailable.");
        }

        var derivedKey = HMACSHA256.HashData(
            Encoding.UTF8.GetBytes(configuredKey),
            Encoding.UTF8.GetBytes("NKRN-Funksieversorging-Print-Link-v1"));

        var payload = Encoding.UTF8.GetBytes($"{requestID}:{expires}");
        return Convert.ToHexString(HMACSHA256.HashData(derivedKey, payload)).ToLowerInvariant();
    }

    private bool IsPrintSignatureValid(int requestID, long expires, string? signature)
    {
        if (string.IsNullOrWhiteSpace(signature))
        {
            return false;
        }

        try
        {
            var supplied = Convert.FromHexString(signature);
            var expected = Convert.FromHexString(CreatePrintSignature(requestID, expires));
            return supplied.Length == expected.Length &&
                CryptographicOperations.FixedTimeEquals(supplied, expected);
        }
        catch (FormatException)
        {
            return false;
        }
    }

    private async Task<(DateTime? SentAt, string? Error)> TrySendNotificationAsync(
        int requestID,
        string firstName,
        string lastName,
        string requesterEmail,
        DateTime neededDate,
        string functionName,
        string venue,
        int attendance,
        string? notes,
        bool leadTimeWarning,
        IReadOnlyCollection<ResolvedItem> items)
    {
        var recipients =
            GetNotificationRecipients(
                requesterEmail);

        var sendInDevelopment =
            _configuration.GetValue<bool>(
                "Funksieversorging:SendEmailInDevelopment");

        if (_environment.IsDevelopment() &&
            !sendInDevelopment)
        {
            return (null, null);
        }

        var subject =
            $"Funksieversorging: Versoek #{requestID} ontvang â€“ {functionName}";

        var printUrl = CreatePrintUrl(requestID);

        var body =
            BuildEmailBody(
                requestID,
                printUrl,
                firstName,
                lastName,
                requesterEmail,
                neededDate,
                functionName,
                venue,
                attendance,
                notes,
                leadTimeWarning,
                items);

        var failures =
            new List<string>();

        var sentCount = 0;

        foreach (var recipient in recipients)
        {
            try
            {
                await _emailService.SendEmailAsync(
                    recipient,
                    subject,
                    body);

                sentCount++;
            }
            catch (Exception ex)
            {
                failures.Add(
                    $"{recipient}: {ex.Message}");
            }
        }

        var sentAt =
            sentCount > 0
                ? DateTime.Now
                : (DateTime?)null;

        string? error =
            failures.Count == 0
                ? null
                : string.Join(
                    " | ",
                    failures);

        if (error != null &&
            error.Length > 1000)
        {
            error =
                error[..1000];
        }

        await UpdateNotificationAsync(
            requestID,
            sentAt,
            error);

        return (sentAt, error);
    }

    private async Task SendStatusUpdateAsync(
        int requestID,
        string requesterName,
        string requesterEmail,
        DateTime neededDate,
        string functionName,
        string venue,
        string status)
    {
        var sendInDevelopment =
            _configuration.GetValue<bool>(
                "Funksieversorging:SendEmailInDevelopment");

        if (_environment.IsDevelopment() &&
            !sendInDevelopment)
        {
            return;
        }

        var recipients =
            GetNotificationRecipients(
                requesterEmail);

        var statusLabel =
            status switch
            {
                "Logged" => "Aangemeld",
                "Busy" => "Besig",
                "Done" => "Afgehandel",
                "Declined" => "Afgekeur",
                _ => status
            };

        var subject =
            $"Funksieversorging: Versoek #{requestID} â€“ {statusLabel}";

        var printUrl = CreatePrintUrl(requestID);
        var body = $"""
            <html>
            <body style="font-family:Arial,sans-serif;color:#222;">
                <h2>Funksieversorging-versoek opgedateer</h2>
                <p>
                    <a href="{WebUtility.HtmlEncode(printUrl)}"
                       style="display:inline-block;background:#b91c2b;color:#fff;text-decoration:none;font-weight:bold;padding:12px 18px;border-radius:7px;">
                       Print hard copy of request / Druk hardekopie van versoek
                    </a>
                </p>
                <p><strong>Versoek:</strong> #{requestID}</p>
                <p><strong>Ingedien deur:</strong> {WebUtility.HtmlEncode(requesterName)}</p>
                <p><strong>Funksie:</strong> {WebUtility.HtmlEncode(functionName)}</p>
                <p><strong>Datum:</strong> {neededDate:yyyy-MM-dd}</p>
                <p><strong>Lokaal:</strong> {WebUtility.HtmlEncode(venue)}</p>
                <p><strong>Nuwe status:</strong> {WebUtility.HtmlEncode(statusLabel)}</p>
                <p>
                    Meld by die NKRN-portaal aan om die versoek
                    en die huidige vordering te besigtig.
                </p>
            </body>
            </html>
            """;

        foreach (var recipient in recipients)
        {
            try
            {
                await _emailService.SendEmailAsync(
                    recipient,
                    subject,
                    body);
            }
            catch
            {
                // A status change must remain saved even if one email fails.
            }
        }
    }

    private async Task UpdateNotificationAsync(
        int requestID,
        DateTime? sentAt,
        string? error)
    {
        await _context.Database.OpenConnectionAsync();

        try
        {
            var connection = _context.Database.GetDbConnection();

            await using var command = connection.CreateCommand();
            command.CommandText = """
                UPDATE dbo.FunksieversorgingRequests
                SET
                    NotificationSentAt = @NotificationSentAt,
                    NotificationError = @NotificationError
                WHERE RequestID = @RequestID;
                """;

            AddParameter(command, "@NotificationSentAt", sentAt);
            AddParameter(command, "@NotificationError", error);
            AddParameter(command, "@RequestID", requestID);

            await command.ExecuteNonQueryAsync();
        }
        finally
        {
            await _context.Database.CloseConnectionAsync();
        }
    }

    private static string BuildEmailBody(
        int requestID,
        string printUrl,
        string firstName,
        string lastName,
        string requesterEmail,
        DateTime neededDate,
        string functionName,
        string venue,
        int attendance,
        string? notes,
        bool leadTimeWarning,
        IEnumerable<ResolvedItem> items)
    {
        static string E(string? value) =>
            WebUtility.HtmlEncode(value ?? string.Empty);

        var rows = string.Join(
            Environment.NewLine,
            items.Select(item =>
            {
                var stock = item.Available.HasValue
                    ? item.Available.Value.ToString()
                    : "Nie vasgelê nie";

                var warning =
                    item.Available.HasValue &&
                    item.Quantity > item.Available.Value
                        ? " <strong style=\"color:#b91c1c;\">(meer as aangetekende voorraad)</strong>"
                        : string.Empty;

                return $"""
                    <tr>
                        <td style="padding:8px;border-bottom:1px solid #ddd;">{E(item.Name)}</td>
                        <td style="padding:8px;border-bottom:1px solid #ddd;">{item.Quantity}</td>
                        <td style="padding:8px;border-bottom:1px solid #ddd;">{stock}{warning}</td>
                    </tr>
                    """;
            })
        );

        var timingWarning = leadTimeWarning
            ? """
              <p style="padding:10px;background:#fff7ed;border:1px solid #fed7aa;">
                <strong>Let wel:</strong> Hierdie versoek is binne drie werksdae van die funksiedatum ingedien.
              </p>
              """
            : string.Empty;

        var notesBlock = string.IsNullOrWhiteSpace(notes)
            ? string.Empty
            : $"<p><strong>Bykomende nota:</strong><br />{E(notes)}</p>";

        return $"""
            <html>
            <body style="margin:0;padding:0;background:#f4f5f7;font-family:Arial,Helvetica,sans-serif;color:#25262a;">
              <div style="max-width:760px;margin:0 auto;padding:24px 12px;">
                <div style="background:#b91c2b;color:#fff;padding:22px 24px;border-radius:12px 12px 0 0;">
                  <p style="margin:0 0 6px;font-size:11px;font-weight:bold;letter-spacing:2px;text-transform:uppercase;">Laerskool Tygerpoort</p>
                  <h2 style="margin:0;font-size:23px;">Nuwe Funksieversorging-versoek</h2>
                  <p style="margin:8px 0 0;color:#fff;font-size:14px;">Versoek #{requestID}</p>
                </div>
                <div style="background:#fff;border:1px solid #e5e7eb;border-top:0;padding:24px;border-radius:0 0 12px 12px;">
                  <p style="margin:0 0 20px;">Gebruik die knoppie hieronder om ’n A4-hardekopie oop te maak en dit te druk. Geen portaal-aanmelding is nodig nie.</p>
                  <p style="margin:0 0 24px;">
                    <a href="{E(printUrl)}" style="display:inline-block;background:#b91c2b;color:#fff;text-decoration:none;font-weight:bold;padding:13px 20px;border-radius:7px;">Print Hard Copy of Request / Druk hardekopie van versoek</a>
                  </p>
                <p><strong>Versoek:</strong> #{requestID}</p>
                <p><strong>Ingedien deur:</strong> {E($"{firstName} {lastName}".Trim())}</p>
                <p><strong>E-pos:</strong> {E(requesterEmail)}</p>
                <p><strong>Funksie:</strong> {E(functionName)}</p>
                <p><strong>Datum benodig:</strong> {neededDate:yyyy-MM-dd}</p>
                <p><strong>Lokaal:</strong> {E(venue)}</p>
                <p><strong>Aantal persone:</strong> {attendance}</p>

                {timingWarning}

                <h3>Gekose voorraad</h3>

                <table style="border-collapse:collapse;width:100%;">
                    <thead>
                        <tr>
                            <th style="padding:8px;text-align:left;border-bottom:2px solid #bbb;">Item</th>
                            <th style="padding:8px;text-align:left;border-bottom:2px solid #bbb;">Benodig</th>
                            <th style="padding:8px;text-align:left;border-bottom:2px solid #bbb;">Aangetekende voorraad</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows}
                    </tbody>
                </table>

                {notesBlock}

                <p>
                    <strong>Terugbesorging:</strong>
                    Die gebruiker het bevestig dat geleende voorraad skoongemaak en volgens afspraak
                    terugbesorg sal word en dat skade of breuke aangemeld sal word.
                </p>
                <p style="margin:24px 0 0;padding-top:14px;border-top:1px solid #e5e7eb;font-size:11px;color:#6b7280;">
                  Laerskool Tygerpoort · Tygies 1 · Funksieversorging
                </p>
                </div>
              </div>
            </body>
            </html>
            """;
    }

    private static int CountWorkingDays(DateTime fromDate, DateTime toDate)
    {
        if (toDate <= fromDate)
        {
            return 0;
        }

        var count = 0;

        for (var date = fromDate.AddDays(1);
             date <= toDate;
             date = date.AddDays(1))
        {
            if (date.DayOfWeek is not DayOfWeek.Saturday
                and not DayOfWeek.Sunday)
            {
                count++;
            }
        }

        return count;
    }

    private int? GetLoggedInUserID()
    {
        var userIDClaim =
            User.FindFirst(ClaimTypes.NameIdentifier)?.Value;

        return int.TryParse(userIDClaim, out var userID)
            ? userID
            : null;
    }

    private static void AddParameter(
        DbCommand command,
        string name,
        object? value)
    {
        var parameter = command.CreateParameter();
        parameter.ParameterName = name;
        parameter.Value = value ?? DBNull.Value;
        command.Parameters.Add(parameter);
    }

    private sealed record InventoryDefinition(
        string Code,
        string Name,
        string Category,
        int? Available,
        bool AttendanceDerived);

    private sealed record ResolvedItem(
        string Code,
        string Name,
        string Category,
        int Quantity,
        int? Available,
        bool AttendanceDerived);
}

public sealed class CreateFunksieversorgingRequest
{
    public DateTime NeededDate { get; set; }
    public string FunctionName { get; set; } = string.Empty;
    public string Venue { get; set; } = string.Empty;
    public string? OtherVenue { get; set; }
    public int Attendance { get; set; }
    public string? Notes { get; set; }
    public bool ReturnAcknowledged { get; set; }
    public List<CreateFunksieversorgingItem> Items { get; set; } = [];
}

public sealed class CreateFunksieversorgingItem
{
    public string Code { get; set; } = string.Empty;
    public int Quantity { get; set; }
    public string? CustomName { get; set; }
}

public sealed class FunksieversorgingRequestResponse
{
    public int RequestID { get; set; }
    public int RequestedByUserID { get; set; }
    public string RequesterName { get; set; } = string.Empty;
    public string RequesterEmail { get; set; } = string.Empty;
    public DateTime NeededDate { get; set; }
    public string FunctionName { get; set; } = string.Empty;
    public string Venue { get; set; } = string.Empty;
    public string? OtherVenue { get; set; }
    public int Attendance { get; set; }
    public string? Notes { get; set; }
    public bool ReturnAcknowledged { get; set; }
    public bool LeadTimeWarning { get; set; }
    public string Status { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public DateTime? NotificationSentAt { get; set; }
    public string? NotificationError { get; set; }
    public List<FunksieversorgingItemResponse> Items { get; set; } = [];
}

public sealed class FunksieversorgingItemResponse
{
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty;
    public int RequestedQuantity { get; set; }
    public int? RecordedAvailableQuantity { get; set; }
    public bool IsAttendanceDerived { get; set; }
}
