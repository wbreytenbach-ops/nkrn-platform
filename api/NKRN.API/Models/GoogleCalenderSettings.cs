namespace NKRN.API.Models
{
    public class GoogleCalendarSettings
    {
        public string ClientId { get; set; } = string.Empty;

        public string ClientSecret { get; set; } = string.Empty;

        public string RedirectUri { get; set; } =
            "https://localhost:7028/api/GoogleCalendar/callback";

        public string CalendarId { get; set; } =
            "primary";
    }
}