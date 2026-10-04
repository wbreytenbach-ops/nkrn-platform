using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using NKRN.API.Data;
using NKRN.API.Models;

namespace NKRN.API.Services;

public sealed class NkrnAiService
{
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IOptionsMonitor<AiSettings> _settings;
    private readonly ApplicationDbContext _context;
    private readonly ILogger<NkrnAiService> _logger;

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true
    };

    private static readonly Regex EmailRegex = new(
        @"\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b",
        RegexOptions.IgnoreCase | RegexOptions.Compiled);

    private static readonly Regex PhoneRegex = new(
        @"(?<!\d)(?:\+?27|0)\s?\d(?:[\s-]?\d){8}(?!\d)",
        RegexOptions.Compiled);

    public NkrnAiService(
        IHttpClientFactory httpClientFactory,
        IOptionsMonitor<AiSettings> settings,
        ApplicationDbContext context,
        ILogger<NkrnAiService> logger)
    {
        _httpClientFactory = httpClientFactory;
        _settings = settings;
        _context = context;
        _logger = logger;
    }

    public object GetPublicStatus()
    {
        var settings = _settings.CurrentValue;

        return new
        {
            enabled = settings.Enabled && !string.IsNullOrWhiteSpace(settings.ApiKey),
            provider = settings.Provider,
            model = settings.Model
        };
    }

    public async Task<AiTriageResult> AnalyseAsync(
        AiTriageRequest request,
        CancellationToken cancellationToken = default)
    {
        var settings = _settings.CurrentValue;
        var cleanDescription = CleanAndLimit(
            request.Description,
            Math.Clamp(settings.MaxDescriptionCharacters, 500, 12000));

        var rule = NkrnRequestRules.Evaluate(
            request.ModuleKey,
            cleanDescription,
            request.AdditionalContext);

        if (string.IsNullOrWhiteSpace(cleanDescription))
        {
            return CreateFallback(request.ModuleKey, "Geen beskrywing is verskaf nie.", rule);
        }

        if (!settings.Enabled || string.IsNullOrWhiteSpace(settings.ApiKey))
        {
            return CreateFallback(request.ModuleKey, cleanDescription, rule);
        }

        try
        {
            var client = _httpClientFactory.CreateClient("NKRN-AI");
            client.Timeout = TimeSpan.FromSeconds(Math.Clamp(settings.TimeoutSeconds, 5, 90));

            var endpoint = $"{settings.BaseUrl.TrimEnd('/')}/chat/completions";
            using var httpRequest = new HttpRequestMessage(HttpMethod.Post, endpoint);
            httpRequest.Headers.Authorization =
                new AuthenticationHeaderValue("Bearer", settings.ApiKey);

            var safeConversation = request.Conversation
                .TakeLast(8)
                .Select(message => new
                {
                    role = NormaliseRole(message.Role),
                    content = CleanAndLimit(message.Content, 1800)
                })
                .Where(message => !string.IsNullOrWhiteSpace(message.content))
                .ToList();

            var userPayload = new
            {
                module = NormaliseModule(request.ModuleKey),
                description = cleanDescription,
                additionalContext = CleanAndLimit(request.AdditionalContext, 2500),
                allowedCategories = request.AllowedCategories
                    .Where(value => !string.IsNullOrWhiteSpace(value))
                    .Distinct(StringComparer.OrdinalIgnoreCase)
                    .Take(60)
                    .ToArray(),
                deterministicRule = new
                {
                    rule.Triggered,
                    rule.Priority,
                    rule.Reason,
                    rule.SuggestedRequestType,
                    rule.NeedsHuman
                },
                conversation = safeConversation
            };

            var payload = new
            {
                model = settings.Model,
                temperature = 0.05,
                response_format = new { type = "json_object" },
                messages = new object[]
                {
                    new
                    {
                        role = "system",
                        content = BuildSystemPrompt(request.ModuleKey)
                    },
                    new
                    {
                        role = "user",
                        content = JsonSerializer.Serialize(userPayload)
                    }
                }
            };

            httpRequest.Content = JsonContent.Create(payload);

            using var response = await client.SendAsync(httpRequest, cancellationToken);
            var responseText = await response.Content.ReadAsStringAsync(cancellationToken);

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning(
                    "NKRN AI provider returned {StatusCode}: {Body}",
                    (int)response.StatusCode,
                    Truncate(responseText, 700));

                return CreateFallback(request.ModuleKey, cleanDescription, rule);
            }

            using var outer = JsonDocument.Parse(responseText);
            var content = outer.RootElement
                .GetProperty("choices")[0]
                .GetProperty("message")
                .GetProperty("content")
                .GetString();

            if (string.IsNullOrWhiteSpace(content))
            {
                return CreateFallback(request.ModuleKey, cleanDescription, rule);
            }

            var parsed = JsonSerializer.Deserialize<ProviderResult>(content, JsonOptions);

            if (parsed == null)
            {
                return CreateFallback(request.ModuleKey, cleanDescription, rule);
            }

            return NormaliseResult(
                request.ModuleKey,
                cleanDescription,
                parsed,
                settings.Provider,
                settings.Model,
                request.AllowedCategories,
                rule);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "NKRN AI analysis failed; deterministic fallback will be used.");
            return CreateFallback(request.ModuleKey, cleanDescription, rule);
        }
    }

    public async Task<AiTriageResult> StartHelpSessionAsync(
        int userID,
        AiTriageRequest request,
        CancellationToken cancellationToken = default)
    {
        var result = await AnalyseAsync(request, cancellationToken);
        var sessionID = Guid.NewGuid();

        try
        {
            var description = CleanAndLimit(request.Description, 12000);
            var context = CleanAndLimit(request.AdditionalContext, 2500);
            var steps = JsonSerializer.Serialize(result.TroubleshootingSteps);

            await _context.Database.ExecuteSqlInterpolatedAsync($"""
                INSERT INTO dbo.AiHelpSessions
                (
                    SessionID,
                    UserID,
                    ModuleKey,
                    Description,
                    AdditionalContext,
                    Provider,
                    Model,
                    SuggestedTitle,
                    SuggestedCategory,
                    SuggestedRequestType,
                    SuggestedPriority,
                    NeedsHuman,
                    Confidence,
                    RuleTriggered,
                    RuleReason,
                    UserMessage,
                    TroubleshootingJson,
                    Outcome,
                    StartedAt
                )
                VALUES
                (
                    {sessionID},
                    {userID},
                    {NormaliseModule(request.ModuleKey)},
                    {description},
                    {context},
                    {result.Provider},
                    {result.Model},
                    {result.SuggestedTitle},
                    {result.SuggestedCategory},
                    {result.SuggestedRequestType},
                    {result.SuggestedPriority},
                    {result.NeedsHuman},
                    {result.Confidence},
                    {result.RuleTriggered},
                    {result.RuleReason},
                    {result.UserMessage},
                    {steps},
                    {"Started"},
                    SYSUTCDATETIME()
                );
                """, cancellationToken);

            await _context.Database.ExecuteSqlInterpolatedAsync($"""
                INSERT INTO dbo.AiHelpMessages
                (SessionID, Role, Content, CreatedAt)
                VALUES
                ({sessionID}, {"user"}, {description}, SYSUTCDATETIME());
                """, cancellationToken);

            var assistantText = BuildStoredAssistantText(result);

            await _context.Database.ExecuteSqlInterpolatedAsync($"""
                INSERT INTO dbo.AiHelpMessages
                (SessionID, Role, Content, CreatedAt)
                VALUES
                ({sessionID}, {"assistant"}, {assistantText}, SYSUTCDATETIME());
                """, cancellationToken);

            result.SessionID = sessionID;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(
                ex,
                "NKRN AI help session could not be stored. AI help remains available.");
        }

        return result;
    }

    public async Task<bool> TryCompleteHelpSessionAsync(
        int userID,
        Guid sessionID,
        string outcome,
        int? requestID = null,
        string? userResponse = null,
        CancellationToken cancellationToken = default)
    {
        var cleanOutcome = NormaliseOutcome(outcome);

        try
        {
            if (!string.IsNullOrWhiteSpace(userResponse))
            {
                var safeResponse = CleanAndLimit(userResponse, 1500);

                await _context.Database.ExecuteSqlInterpolatedAsync($"""
                    INSERT INTO dbo.AiHelpMessages
                    (SessionID, Role, Content, CreatedAt)
                    SELECT {sessionID}, {"user"}, {safeResponse}, SYSUTCDATETIME()
                    WHERE EXISTS
                    (
                        SELECT 1
                        FROM dbo.AiHelpSessions
                        WHERE SessionID = {sessionID}
                          AND UserID = {userID}
                    );
                    """, cancellationToken);
            }

            var affected = await _context.Database.ExecuteSqlInterpolatedAsync($"""
                UPDATE dbo.AiHelpSessions
                SET
                    Outcome = {cleanOutcome},
                    RequestID = {requestID},
                    CompletedAt = SYSUTCDATETIME()
                WHERE
                    SessionID = {sessionID}
                    AND UserID = {userID};
                """, cancellationToken);

            return affected == 1;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "NKRN AI help session {SessionID} could not be completed.", sessionID);
            return false;
        }
    }

    public async Task TryStoreAnalysisAsync(
        string moduleKey,
        int requestID,
        AiTriageResult analysis,
        CancellationToken cancellationToken = default)
    {
        try
        {
            var stepsJson = JsonSerializer.Serialize(analysis.TroubleshootingSteps);

            await _context.Database.ExecuteSqlInterpolatedAsync($"""
                INSERT INTO dbo.AiRequestAnalyses
                (
                    ModuleKey,
                    RequestID,
                    Provider,
                    Model,
                    Success,
                    Summary,
                    SuggestedTitle,
                    SuggestedCategory,
                    SuggestedPriority,
                    NeedsHuman,
                    Confidence,
                    RoutingReason,
                    UserMessage,
                    TroubleshootingJson,
                    RuleTriggered,
                    RuleReason,
                    CreatedAt
                )
                VALUES
                (
                    {NormaliseModule(moduleKey)},
                    {requestID},
                    {analysis.Provider},
                    {analysis.Model},
                    {analysis.Success},
                    {analysis.Summary},
                    {analysis.SuggestedTitle},
                    {analysis.SuggestedCategory},
                    {analysis.SuggestedPriority},
                    {analysis.NeedsHuman},
                    {analysis.Confidence},
                    {analysis.RoutingReason},
                    {analysis.UserMessage},
                    {stepsJson},
                    {analysis.RuleTriggered},
                    {analysis.RuleReason},
                    SYSUTCDATETIME()
                );
                """, cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(
                ex,
                "AI analysis for {ModuleKey} request {RequestID} could not be written to the audit table.",
                moduleKey,
                requestID);
        }
    }

    public static AiTriageResult CreateFallback(
        string moduleKey,
        string description,
        NkrnRuleResult? rule = null)
    {
        var module = NormaliseModule(moduleKey);
        var activeRule = rule ?? NkrnRequestRules.Evaluate(module, description);
        var priority = activeRule.Triggered
            ? activeRule.Priority
            : "Medium";

        return new AiTriageResult
        {
            Success = false,
            Provider = "Fallback",
            Model = string.Empty,
            ModuleKey = module,
            SuggestedTitle = CreateFallbackTitle(description),
            Summary = Truncate(description, 260),
            SuggestedRequestType = activeRule.SuggestedRequestType,
            SuggestedPriority = priority,
            NeedsHuman = activeRule.NeedsHuman || true,
            Confidence = activeRule.Triggered ? 0.95 : 0,
            UserMessage = activeRule.Triggered && priority == "Critical"
                ? "Dit lyk na ’n dringende probleem. Dien asseblief die versoek in sodat die regte span dit onmiddellik kan hanteer."
                : "NKRN kon nie die AI-diens bereik nie. Jy kan steeds die versoek indien.",
            RoutingReason = activeRule.Reason ?? "Veilige standaardroete word gebruik.",
            RuleTriggered = activeRule.Triggered,
            RuleReason = activeRule.Reason
        };
    }

    public static string CreateFallbackTitle(string? description)
    {
        var clean = Regex.Replace(description?.Trim() ?? string.Empty, @"\s+", " ");

        if (string.IsNullOrWhiteSpace(clean))
        {
            return "Versoek";
        }

        return Truncate(clean, 90);
    }

    public static string NormaliseItPriority(string? value, string fallback = "Medium") =>
        NkrnRequestRules.NormalisePriority(value, fallback);

    public static string NormaliseLogisticsPriority(string? value, string fallback = "Medium") =>
        NkrnRequestRules.NormalisePriority(value, fallback);

    private static AiTriageResult NormaliseResult(
        string moduleKey,
        string description,
        ProviderResult parsed,
        string provider,
        string model,
        IReadOnlyCollection<string> allowedCategories,
        NkrnRuleResult rule)
    {
        var module = NormaliseModule(moduleKey);
        var category = MatchCategory(parsed.SuggestedCategory, allowedCategories);
        var aiPriority = NkrnRequestRules.NormalisePriority(parsed.SuggestedPriority);
        var finalPriority = NkrnRequestRules.MergePriority(rule.Priority, aiPriority);

        var requestType = rule.SuggestedRequestType ??
            NormaliseRequestType(parsed.SuggestedRequestType);

        var critical = finalPriority == "Critical";

        return new AiTriageResult
        {
            Success = true,
            Provider = provider,
            Model = model,
            ModuleKey = module,
            SuggestedTitle = string.IsNullOrWhiteSpace(parsed.SuggestedTitle)
                ? CreateFallbackTitle(description)
                : Truncate(parsed.SuggestedTitle.Trim(), 100),
            Summary = string.IsNullOrWhiteSpace(parsed.Summary)
                ? Truncate(description, 260)
                : Truncate(parsed.Summary.Trim(), 1200),
            SuggestedCategory = category,
            SuggestedRequestType = requestType,
            SuggestedPriority = finalPriority,
            NeedsHuman = parsed.NeedsHuman || rule.NeedsHuman || critical,
            Confidence = rule.Triggered
                ? Math.Max(Math.Clamp(parsed.Confidence, 0, 1), 0.95)
                : Math.Clamp(parsed.Confidence, 0, 1),
            UserMessage = critical
                ? "Dit lyk na ’n dringende probleem. Moenie self aan gevaarlike toerusting of infrastruktuur werk nie. Dien die versoek in sodat dit onmiddellik hanteer kan word."
                : Truncate(
                    string.IsNullOrWhiteSpace(parsed.UserMessage)
                        ? "Ek het die probleem nagegaan. Probeer die stappe hieronder."
                        : parsed.UserMessage.Trim(),
                    1400),
            TroubleshootingSteps = critical
                ? new List<string>()
                : (parsed.TroubleshootingSteps ?? new List<string>())
                    .Where(step => !string.IsNullOrWhiteSpace(step))
                    .Select(step => Truncate(step.Trim(), 500))
                    .Take(4)
                    .ToList(),
            RoutingReason = rule.Triggered
                ? rule.Reason ?? "NKRN-veiligheidsreël het die versoek opgegradeer."
                : Truncate(
                    string.IsNullOrWhiteSpace(parsed.RoutingReason)
                        ? "Geklassifiseer volgens die beskrywing."
                        : parsed.RoutingReason.Trim(),
                    900),
            RuleTriggered = rule.Triggered,
            RuleReason = rule.Reason
        };
    }

    private static string? MatchCategory(
        string? suggested,
        IReadOnlyCollection<string> allowedCategories)
    {
        if (string.IsNullOrWhiteSpace(suggested) || allowedCategories.Count == 0)
        {
            return null;
        }

        var exact = allowedCategories.FirstOrDefault(category =>
            category.Equals(suggested.Trim(), StringComparison.OrdinalIgnoreCase));

        if (exact != null)
        {
            return exact;
        }

        var suggestion = suggested.Trim().ToLowerInvariant();

        return allowedCategories
            .Select(category => new
            {
                Category = category,
                Score = TokenOverlapScore(suggestion, category.ToLowerInvariant())
            })
            .Where(item => item.Score >= 0.5)
            .OrderByDescending(item => item.Score)
            .Select(item => item.Category)
            .FirstOrDefault();
    }

    private static double TokenOverlapScore(string left, string right)
    {
        var a = Regex.Split(left, @"\W+")
            .Where(value => value.Length >= 3)
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        var b = Regex.Split(right, @"\W+")
            .Where(value => value.Length >= 3)
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        if (a.Count == 0 || b.Count == 0)
        {
            return 0;
        }

        return (double)a.Intersect(b, StringComparer.OrdinalIgnoreCase).Count() /
               Math.Min(a.Count, b.Count);
    }

    private static string BuildSystemPrompt(string moduleKey)
    {
        var module = NormaliseModule(moduleKey);

        return $$"""
            Jy is die NKRN-hulpassistent vir Laerskool Tygerpoort.

            Module: {{module}}

            SKRYFSTYL:
            - Skryf natuurlike, vlot Suid-Afrikaanse Afrikaans.
            - Skryf soos ’n bekwame kollega by ’n laerskool, nie soos ’n vertaalprogram nie.
            - Gebruik kort, eenvoudige sinne.
            - Gebruik "jy" en "jou".
            - Gebruik "versoek" as die algemene NKRN-term.
            - Moenie Afrikaans en Engels onnatuurlik in dieselfde sin meng nie.
            - Hou gewone tegniese produkname in Engels waar dit normaal is: Windows, Wi-Fi,
              HDMI, Chromebook, Microsoft 365, Google Chrome, modelname van drukkers en projektors.
            - Vermy korporatiewe of letterlike vertalings soos "triage", "roetering",
              "menslike intervensie", "konnektiwiteit verifieer", "display-kabel" en
              "operasionele versoek".
            - Geen onnodige inleidings soos "Ek verstaan", "Natuurlik" of "Dit klink asof" nie.
            - Moenie sê dat iets reeds gestuur, toegeken, verander of voltooi is nie.
              Die NKRN-backend doen daardie werk.

            GOEIE VOORBEELDE:
            - "Kyk of die HDMI-kabel stewig ingeprop is."
            - "Kies die regte invoerbron op die projektor."
            - "Herbegin die rekenaar en probeer weer."
            - "As dit steeds nie werk nie, dien die versoek in."
            - "Dit lyk na ’n dringende instandhoudingsprobleem. Dien die versoek onmiddellik in."

            JOU TAAK:
            - Gee ’n kort, natuurlike titel.
            - Som die probleem bondig op.
            - Kies slegs ’n kategorie uit allowedCategories. Moenie ’n nuwe kategorie uitdink nie.
            - Stel requestType vir Logistics voor as Event, Maintenance of General.
            - Stel prioriteit voor as Low, Medium, High of Critical.
            - Gee hoogstens vier eenvoudige, veilige hulpstappe waar dit sin maak.
            - Vir ’n veiligheids- of infrastruktuurrisiko: gee nie herstel-instruksies nie.
              needsHuman moet true wees.
            - ’n Deterministiese NKRN-reël mag prioriteit verhoog. Jy mag dit nooit verlaag nie.

            PRIORITEIT:
            - Low: kan wag sonder noemenswaardige ontwrigting.
            - Medium: normale versoek.
            - High: beduidende ontwrigting of spoedige aandag nodig.
            - Critical: onmiddellike veiligheidsrisiko, groot skade, skoolwye onderbreking,
              aktiewe water/rioolprobleem, brand- of elektriese gevaar.

            Antwoord slegs met JSON.

            {
              "suggestedTitle": "string",
              "summary": "string",
              "suggestedCategory": "string or null",
              "suggestedRequestType": "Event | Maintenance | General | null",
              "suggestedPriority": "Low | Medium | High | Critical",
              "needsHuman": true,
              "confidence": 0.0,
              "userMessage": "string",
              "troubleshootingSteps": ["string"],
              "routingReason": "string"
            }
            """;
    }

    private static string BuildStoredAssistantText(AiTriageResult result)
    {
        var steps = result.TroubleshootingSteps.Count == 0
            ? string.Empty
            : " " + string.Join(" ", result.TroubleshootingSteps.Select((step, index) => $"{index + 1}. {step}"));

        return Truncate($"{result.UserMessage}{steps}", 6000);
    }

    private static string NormaliseOutcome(string? value) =>
        value?.Trim().ToLowerInvariant() switch
        {
            "resolvedbyai" or "resolved" or "reggekom" => "ResolvedByAI",
            "requestlogged" or "logged" => "RequestLogged",
            "humanrequired" => "HumanRequired",
            "abandoned" => "Abandoned",
            _ => "Abandoned"
        };

    private static string? NormaliseRequestType(string? value) =>
        value?.Trim().ToLowerInvariant() switch
        {
            "event" => "Event",
            "maintenance" => "Maintenance",
            "general" => "General",
            _ => null
        };

    private static string NormaliseRole(string? role) =>
        role?.Trim().ToLowerInvariant() switch
        {
            "assistant" => "assistant",
            _ => "user"
        };

    public static string NormaliseModule(string? moduleKey) =>
        moduleKey?.Trim().ToLowerInvariant() switch
        {
            "logistics" or "logistiek" => "Logistics",
            "funksieversorging" or "dameskomitee" => "Funksieversorging",
            _ => "IT"
        };

    private static string CleanAndLimit(string? value, int maxLength)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return string.Empty;
        }

        var clean = value.Trim();
        clean = EmailRegex.Replace(clean, "[e-pos verwyder]");
        clean = PhoneRegex.Replace(clean, "[telefoonnommer verwyder]");

        return Truncate(clean, maxLength);
    }

    private static string Truncate(string? value, int maxLength)
    {
        if (string.IsNullOrEmpty(value) || value.Length <= maxLength)
        {
            return value ?? string.Empty;
        }

        return value[..maxLength];
    }

    private sealed class ProviderResult
    {
        public string? SuggestedTitle { get; set; }
        public string? Summary { get; set; }
        public string? SuggestedCategory { get; set; }
        public string? SuggestedRequestType { get; set; }
        public string? SuggestedPriority { get; set; }
        public bool NeedsHuman { get; set; } = true;
        public double Confidence { get; set; }
        public string? UserMessage { get; set; }
        public List<string>? TroubleshootingSteps { get; set; }
        public string? RoutingReason { get; set; }
    }
}
