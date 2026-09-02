using Google.Apis.Auth.OAuth2.Flows;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;
using NKRN.API.Models;
using NKRN.API.Services;

namespace NKRN.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class GoogleCalendarController : ControllerBase
    {
        private readonly GoogleCalendarSettings _settings;
        private readonly GoogleCalendarService _calendarService;

        public GoogleCalendarController(
            IOptions<GoogleCalendarSettings> settings,
            GoogleCalendarService calendarService)
        {
            _settings = settings.Value;
            _calendarService = calendarService;
        }

        // ============================================================
        // START GOOGLE OAUTH
        // ============================================================

        [HttpGet("authorize")]
        public IActionResult Authorize()
        {
            var flow =
                _calendarService.CreateAuthorizationFlow();

            var authorizationUrl =
                flow.CreateAuthorizationCodeRequest(
                    _settings.RedirectUri
                );

            return Redirect(
                authorizationUrl.Build().AbsoluteUri
            );
        }

        // ============================================================
        // GOOGLE OAUTH CALLBACK
        // ============================================================

        [HttpGet("callback")]
        public async Task<IActionResult> Callback(
            string? code,
            string? error = null)
        {
            if (!string.IsNullOrWhiteSpace(error))
            {
                return BadRequest(
                    $"Google authorization failed: {error}"
                );
            }

            if (string.IsNullOrWhiteSpace(code))
            {
                return BadRequest(
                    "Google did not return an authorization code."
                );
            }

            var flow =
                _calendarService.CreateAuthorizationFlow();

            var tokenResponse =
                await flow.ExchangeCodeForTokenAsync(
                    "itdesk@tygerpoort.co.za",
                    code,
                    _settings.RedirectUri,
                    CancellationToken.None
                );

            if (tokenResponse == null)
            {
                return BadRequest(
                    "Google did not return a valid authorization token."
                );
            }

            return Ok(
                "Google Calendar authorization successful. " +
                "The IT Desk calendar is now connected."
            );
        }

        // ============================================================
        // TEST CALENDAR EVENT
        // ============================================================

        [HttpGet("test-event")]
        public async Task<IActionResult> TestEvent()
        {
            var start = DateTime.Now.AddMinutes(10);
            var end = start.AddMinutes(30);

            var eventId =
                await _calendarService.CreateEventAsync(
                    "itdesk@tygerpoort.co.za",
                    "IT Desk Calendar Test",
                    "This is a test event created by the Tygerpoort IT Desk system.",
                    start,
                    end
                );

            return Ok(new
            {
                message = "Test Calendar event created successfully.",
                eventId,
                start,
                end
            });
        }
    }
}