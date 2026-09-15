using Google.Apis.Auth.OAuth2;
using Google.Apis.Auth.OAuth2.Flows;
using Google.Apis.Auth.OAuth2.Responses;
using Google.Apis.Calendar.v3;
using Google.Apis.Calendar.v3.Data;
using Google.Apis.Services;
using Google.Apis.Util.Store;
using Microsoft.Extensions.Options;
using NKRN.API.Models;

namespace NKRN.API.Services
{
    public class GoogleCalendarService
    {
        private readonly GoogleCalendarSettings _settings;

        public GoogleCalendarService(
            IOptions<GoogleCalendarSettings> settings)
        {
            _settings = settings.Value;
        }

        // ============================================================
        // CREATE GOOGLE AUTHORIZATION FLOW
        // ============================================================

        public GoogleAuthorizationCodeFlow CreateAuthorizationFlow()
        {
            return new GoogleAuthorizationCodeFlow(
                new GoogleAuthorizationCodeFlow.Initializer
                {
                    ClientSecrets = new ClientSecrets
                    {
                        ClientId = _settings.ClientId,
                        ClientSecret = _settings.ClientSecret
                    },

                    Scopes = new[]
                    {
                        CalendarService.Scope.Calendar
                    },

                    DataStore = new FileDataStore(
                        Path.Combine(
                            AppContext.BaseDirectory,
                            "GoogleAuth"
                        )
                    )
                }
            );
        }

        // ============================================================
        // CREATE GOOGLE CALENDAR SERVICE
        // ============================================================

        public async Task<CalendarService> CreateCalendarServiceAsync(
            string userId)
        {
            var flow = CreateAuthorizationFlow();

            var tokenResponse =
                await flow.DataStore.GetAsync<TokenResponse>(
                    userId
                );

            if (tokenResponse == null)
            {
                throw new InvalidOperationException(
                    "Google Calendar has not been authorized yet."
                );
            }

            var credential =
                new UserCredential(
                    flow,
                    userId,
                    tokenResponse
                );

            return new CalendarService(
                new BaseClientService.Initializer
                {
                    HttpClientInitializer = credential,
                    ApplicationName = "Tygerpoort IT Desk"
                }
            );
        }

        // ============================================================
        // CREATE CALENDAR EVENT
        // ============================================================

        public async Task<string> CreateEventAsync(
            string userId,
            string summary,
            string description,
            DateTime start,
            DateTime end,
            IEnumerable<string>? attendeeEmails = null)
        {
            var calendarService =
                await CreateCalendarServiceAsync(userId);

            var calendarEvent =
                BuildCalendarEvent(
                    summary,
                    description,
                    start,
                    end,
                    attendeeEmails
                );

            var request =
                calendarService.Events.Insert(
                    calendarEvent,
                    _settings.CalendarId
                );

            request.SendUpdates =
                EventsResource.InsertRequest.SendUpdatesEnum.All;

            var createdEvent =
                await request.ExecuteAsync();

            if (string.IsNullOrWhiteSpace(createdEvent.Id))
            {
                throw new InvalidOperationException(
                    "Google Calendar did not return an event ID."
                );
            }

            return createdEvent.Id;
        }

        // ============================================================
        // UPDATE EXISTING CALENDAR EVENT
        // ============================================================

        public async Task UpdateEventAsync(
            string userId,
            string eventId,
            string summary,
            string description,
            DateTime start,
            DateTime end,
            IEnumerable<string>? attendeeEmails = null)
        {
            var calendarService =
                await CreateCalendarServiceAsync(userId);

            var calendarEvent =
                BuildCalendarEvent(
                    summary,
                    description,
                    start,
                    end,
                    attendeeEmails
                );

            var request =
                calendarService.Events.Update(
                    calendarEvent,
                    _settings.CalendarId,
                    eventId
                );

            request.SendUpdates =
                EventsResource.UpdateRequest.SendUpdatesEnum.All;

            await request.ExecuteAsync();
        }

        // ============================================================
        // DELETE EXISTING CALENDAR EVENT
        // ============================================================

        public async Task DeleteEventAsync(
            string userId,
            string eventId)
        {
            var calendarService =
                await CreateCalendarServiceAsync(userId);

            var request =
                calendarService.Events.Delete(
                    _settings.CalendarId,
                    eventId
                );

            request.SendUpdates =
                EventsResource.DeleteRequest.SendUpdatesEnum.All;

            await request.ExecuteAsync();
        }

        // Logistics uses the existing OAuth store and calendar, with a client-assigned ID.
        // A lost insert response is safe to retry: the same ID is updated, never duplicated.
        public async Task UpsertLogisticsEventAsync(string userId, string eventId, LogisticsWorkPlanItem item, string workerName)
        {
            using var calendar = await CreateCalendarServiceAsync(userId);
            if (item.Status is "Cancelled" or "Gekanselleer")
            {
                try { await calendar.Events.Delete(_settings.CalendarId, eventId).ExecuteAsync(); }
                catch (Google.GoogleApiException ex) when (ex.HttpStatusCode == System.Net.HttpStatusCode.NotFound || ex.HttpStatusCode == System.Net.HttpStatusCode.Gone) { }
                return;
            }
            var value = new Event {
                Id = eventId,
                Summary = $"Logistics: {item.TaskDescription} — {workerName} [{item.Status}]",
                Description = $"Verantwoordelik: {workerName}\nPrioriteit: {item.Priority}\nMateriaal: {item.MaterialsRequired}\nNota: {item.ManagerNote}\nStatus: {item.Status}",
                Location = item.Area
            };
            if (item.PlannedStart.HasValue && item.PlannedEnd.HasValue)
            {
                var start = item.WorkDate.Date.Add(item.PlannedStart.Value);
                var end = item.WorkDate.Date.Add(item.PlannedEnd.Value);
                if (end <= start) throw new InvalidOperationException("Planned end must follow start.");
                value.Start = new EventDateTime { DateTimeDateTimeOffset = CreateSouthAfricanDateTime(start), TimeZone = "Africa/Johannesburg" };
                value.End = new EventDateTime { DateTimeDateTimeOffset = CreateSouthAfricanDateTime(end), TimeZone = "Africa/Johannesburg" };
            }
            else
            {
                value.Start = new EventDateTime { Date = item.WorkDate.ToString("yyyy-MM-dd") };
                value.End = new EventDateTime { Date = item.WorkDate.AddDays(1).ToString("yyyy-MM-dd") };
            }
            try { await calendar.Events.Update(value, _settings.CalendarId, eventId).ExecuteAsync(); }
            catch (Google.GoogleApiException ex) when (ex.HttpStatusCode == System.Net.HttpStatusCode.NotFound)
            {
                try { await calendar.Events.Insert(value, _settings.CalendarId).ExecuteAsync(); }
                catch (Google.GoogleApiException conflict) when (conflict.HttpStatusCode == System.Net.HttpStatusCode.Conflict)
                { await calendar.Events.Update(value, _settings.CalendarId, eventId).ExecuteAsync(); }
            }
        }

        // ============================================================
        // BUILD CALENDAR EVENT
        // ============================================================

        private static Event BuildCalendarEvent(
            string summary,
            string description,
            DateTime start,
            DateTime end,
            IEnumerable<string>? attendeeEmails)
        {
            var calendarEvent = new Event
            {
                Summary = summary,
                Description = description,

                Start = new EventDateTime
                {
                    DateTimeDateTimeOffset =
                        CreateSouthAfricanDateTime(start),

                    TimeZone = "Africa/Johannesburg"
                },

                End = new EventDateTime
                {
                    DateTimeDateTimeOffset =
                        CreateSouthAfricanDateTime(end),

                    TimeZone = "Africa/Johannesburg"
                }
            };

            // ========================================================
            // ADD ALL ATTENDEES
            // ========================================================

            if (attendeeEmails != null)
            {
                var uniqueEmails =
                    attendeeEmails
                        .Where(email =>
                            !string.IsNullOrWhiteSpace(email))
                        .Select(email =>
                            email.Trim())
                        .Distinct(
                            StringComparer.OrdinalIgnoreCase)
                        .ToList();

                if (uniqueEmails.Count > 0)
                {
                    calendarEvent.Attendees =
                        uniqueEmails
                            .Select(email =>
                                new EventAttendee
                                {
                                    Email = email
                                })
                            .ToList();
                }
            }

            return calendarEvent;
        }

        // ============================================================
        // SOUTH AFRICAN TIME
        // ============================================================

        private static DateTimeOffset CreateSouthAfricanDateTime(
            DateTime dateTime)
        {
            var unspecified =
                DateTime.SpecifyKind(
                    dateTime,
                    DateTimeKind.Unspecified
                );

            return new DateTimeOffset(
                unspecified,
                TimeSpan.FromHours(2)
            );
        }
    }
}