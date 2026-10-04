namespace NKRN.API.Services;

public static class LogisticsWorkflow
{
    public static string StatusLabel(string? status) =>
        NkrnRequestRules.NormaliseRequestStatus(status) switch
        {
            "Logged" => "Aangemeld",
            "Busy" => "Besig",
            "Done" => "Afgehandel",
            "Cancelled" => "Gekanselleer",
            "Declined" => "Afgekeur",
            _ => status ?? string.Empty
        };

    public static string PriorityLabel(string? priority) =>
        NkrnRequestRules.NormalisePriority(priority) switch
        {
            "Critical" => "Kritiek",
            "High" => "Hoog",
            "Medium" => "Medium",
            "Low" => "Laag",
            _ => priority ?? string.Empty
        };
}
