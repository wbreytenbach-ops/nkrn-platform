using System.Text.RegularExpressions;

namespace NKRN.API.Services;

public sealed record NkrnRuleResult(
    string Priority,
    bool Triggered,
    string? Reason = null,
    string? SuggestedRequestType = null,
    bool NeedsHuman = false);

public static class NkrnRequestRules
{
    private static readonly Dictionary<string, int> PriorityRank =
        new(StringComparer.OrdinalIgnoreCase)
        {
            ["Low"] = 1,
            ["Medium"] = 2,
            ["High"] = 3,
            ["Critical"] = 4
        };

    public static NkrnRuleResult Evaluate(
        string? moduleKey,
        string? description,
        string? additionalContext = null)
    {
        var module = NormaliseModule(moduleKey);
        var text = $"{description} {additionalContext}".ToLowerInvariant();

        if (module == "Logistics")
        {
            if (Has(text, @"\b(pyp|water|kraan|toilet|riool)\b") &&
                Has(text, @"\b(gebars|bars|gebarste|lek|lekkasie|oorloop|loop\s+oor|stroom|vloei|vloed)\b"))
            {
                return new(
                    "Critical",
                    true,
                    "Aktiewe water-, pyp- of rioolprobleem wat skade of ’n veiligheidsrisiko kan veroorsaak.",
                    "Maintenance",
                    true);
            }

            if (Has(text, @"\b(rook|vonke|brand|brandreuk|oop draad|blootgestelde draad|elektriese skok)\b"))
            {
                return new(
                    "Critical",
                    true,
                    "Moontlike elektriese of brandgevaar.",
                    "Maintenance",
                    true);
            }

            if (Has(text, @"\b(hek|deur|slot|sekuriteit|inbraak)\b") &&
                Has(text, @"\b(gebreek|breek|stukkend|kan nie sluit|oop)\b"))
            {
                return new(
                    "High",
                    true,
                    "Sekuriteits- of toegangspunt is beskadig of onveilig.",
                    "Maintenance",
                    true);
            }

            if (Has(text, @"\b(verstop|verstopping|toilet|drein)\b"))
            {
                return new(
                    "High",
                    true,
                    "Sanitêre of dreineringsprobleem benodig spoedige aandag.",
                    "Maintenance",
                    true);
            }
        }

        if (module == "IT")
        {
            if (Has(text, @"\b(rook|vonke|brandreuk|oorverhit|blootgestelde draad|elektriese skok)\b"))
            {
                return new(
                    "Critical",
                    true,
                    "Moontlike elektriese gevaar by IT-toerusting.",
                    null,
                    true);
            }

            if (Has(text, @"\b(hele skool|almal|skoolwyd|server|bediener|internet|netwerk)\b") &&
                Has(text, @"\b(af|down|werk nie|geen verbinding|offline)\b"))
            {
                return new(
                    "Critical",
                    true,
                    "Moontlike skoolwye diensonderbreking.",
                    null,
                    true);
            }

            if (Has(text, @"\b(klas|les|assessering|eksamen)\b") &&
                Has(text, @"\b(kan nie|werk nie|geen beeld|druk nie)\b"))
            {
                return new(
                    "High",
                    true,
                    "Die probleem belemmer ’n aktiewe klas- of assesseringsaktiwiteit.");
            }
        }

        return new("Medium", false);
    }

    public static string MergePriority(string? first, string? second)
    {
        var a = NormalisePriority(first);
        var b = NormalisePriority(second);

        return PriorityRank[a] >= PriorityRank[b] ? a : b;
    }

    public static string NormalisePriority(string? value, string fallback = "Medium")
    {
        return value?.Trim().ToLowerInvariant() switch
        {
            "critical" or "kritiek" or "p1" => "Critical",
            "high" or "hoog" or "p2" => "High",
            "medium" or "normaal" or "p3" => "Medium",
            "low" or "laag" or "p4" => "Low",
            _ => PriorityRank.ContainsKey(fallback) ? fallback : "Medium"
        };
    }

    public static string ToLegacyTaskPriority(string? value) =>
        NormalisePriority(value) switch
        {
            "Critical" => "P1",
            "High" => "P2",
            "Low" => "P4",
            _ => "P3"
        };

    public static string NormaliseRequestStatus(string? value) =>
        value?.Trim().ToLowerInvariant() switch
        {
            "logged" or "new" or "nog nie begin" or "beplan" => "Logged",
            "busy" or "under review" or "needs information" or "approved" or "converted" or "in proses" or "staan oor" => "Busy",
            "done" or "completed" or "afgehandel" => "Done",
            "cancelled" or "gekanselleer" => "Cancelled",
            "declined" or "afgekeur" => "Declined",
            _ => "Logged"
        };

    public static string ToLegacyTaskStatus(string? requestStatus) =>
        NormaliseRequestStatus(requestStatus) switch
        {
            "Done" => "Afgehandel",
            "Logged" => "Nog nie begin",
            "Cancelled" or "Declined" => "Cancelled",
            _ => "In Proses"
        };

    private static bool Has(string text, string pattern) =>
        Regex.IsMatch(text, pattern, RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);

    private static string NormaliseModule(string? moduleKey) =>
        moduleKey?.Trim().ToLowerInvariant() switch
        {
            "logistics" or "logistiek" => "Logistics",
            "funksieversorging" or "dameskomitee" => "Funksieversorging",
            _ => "IT"
        };
}
