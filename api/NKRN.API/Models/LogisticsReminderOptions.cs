namespace NKRN.API.Models;

public sealed class LogisticsReminderOptions
{
    public bool Enabled { get; set; } = true;

    // Automatic reminder delivery is deliberately disabled in Development.
    // Admins can still use the preview endpoint locally.
    public bool SendInDevelopment { get; set; } = false;

    public int CheckHour { get; set; } = 7;

    public int CheckIntervalMinutes { get; set; } = 60;

    public string[] RecipientEmails { get; set; } =
    {
        "terreinbestuur@tygies.co.za",
        "logistiek@tygies.co.za",
        "msmit@tygies.co.za"
    };
}
