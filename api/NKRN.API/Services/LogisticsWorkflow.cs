namespace NKRN.API.Services;

// Keep existing database codes compatible with historical tasks and job cards.
public static class LogisticsWorkflow
{
    public static string StatusLabel(string status) => status.Trim().ToLowerInvariant() switch
    {
        "new" or "nog nie begin" or "beplan" or "logged" => "Logged / Aangemeld",
        "under review" or "needs information" or "approved" or "converted" or "in proses" or "staan oor" or "busy" => "Busy / Besig",
        "completed" or "afgehandel" or "done" => "Done / Afgehandel",
        "declined" => "Declined / Afgekeur",
        "cancelled" or "gekanselleer" => "Cancelled / Gekanselleer",
        _ => status
    };
    public static string PriorityLabel(string priority) => priority.Trim().ToUpperInvariant() switch
    {
        "P1" => "Critical / Kritiek", "P2" => "High / Hoog",
        "P3" => "Medium / Medium", "P4" => "Low / Laag", _ => priority
    };
}
