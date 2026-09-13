using System.Net;
using System.Security.Claims;
using System.Text;
using NKRN.API.Data;
using NKRN.API.Models;
using NKRN.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace NKRN.API.Controllers
{
    [ApiController]
    [Route("api/LogisticsJobCards")]
    [Authorize]
    public class LogisticsJobCardEmailController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        private readonly EmailService _emailService;
        private readonly ILogger<LogisticsJobCardEmailController> _logger;

        public LogisticsJobCardEmailController(
            ApplicationDbContext context,
            EmailService emailService,
            ILogger<LogisticsJobCardEmailController> logger)
        {
            _context = context;
            _emailService = emailService;
            _logger = logger;
        }

        // ============================================================
        // SEND JOB CARD EMAIL
        // ============================================================

        [HttpPost("{id}/send")]
        public async Task<IActionResult> SendJobCard(int id)
        {
            if (!await CanManageLogistics())
            {
                return Forbid();
            }

            var card =
                await _context.LogisticsJobCards
                    .FirstOrDefaultAsync(card =>
                        card.JobCardID == id);

            if (card == null)
            {
                return NotFound(new
                {
                    message =
                        "Logistics job card not found."
                });
            }

            if (card.SentAt.HasValue ||
                card.Status == "Sent")
            {
                return Conflict(new
                {
                    message =
                        "This job card has already been sent."
                });
            }

            if (string.IsNullOrWhiteSpace(
                    card.RecipientEmail))
            {
                return BadRequest(new
                {
                    message =
                        "The job card does not have a recipient email address."
                });
            }

            var items =
                await _context.LogisticsJobCardItems
                    .AsNoTracking()
                    .Where(item =>
                        item.JobCardID == id)
                    .OrderBy(item =>
                        item.SortOrder)
                    .ToListAsync();

            if (items.Count == 0)
            {
                return BadRequest(new
                {
                    message =
                        "The job card does not contain any items."
                });
            }

            string subject =
                "Daaglikse Logistieke Jobcard - " +
                card.JobCardDate.ToString(
                    "dd MMMM yyyy");

            string body =
                BuildEmailBody(
                    card,
                    items);

            try
            {
                await _emailService.SendEmailAsync(
                    card.RecipientEmail,
                    subject,
                    body);

                card.Status = "Sent";
                card.SentAt = DateTime.Now;

                await _context.SaveChangesAsync();

                return Ok(new
                {
                    card.JobCardID,
                    card.JobCardNumber,
                    card.RecipientEmail,
                    card.SentAt,

                    message =
                        "Logistics job card sent successfully."
                });
            }
            catch (Exception exception)
            {
                _logger.LogError(
                    exception,
                    "Failed to send Logistics job card {JobCardID}.",
                    id);

                return StatusCode(
                    500,
                    new
                    {
                        message =
                            "The job card could not be emailed. It remains unsent."
                    });
            }
        }

        // ============================================================
        // BUILD EMAIL BODY
        // ============================================================

        private static string BuildEmailBody(
            LogisticsJobCard card,
            List<LogisticsJobCardItem> items)
        {
            var html = new StringBuilder();

            html.Append(
                "<html><body style='font-family:Arial,sans-serif;background:#f4f4f4;padding:20px;'>");

            html.Append(
                "<div style='max-width:760px;margin:auto;background:#ffffff;border-radius:10px;overflow:hidden;'>");

            html.Append(
                "<div style='background:#171717;color:#ffffff;padding:24px;'>");

            html.Append(
                "<div style='font-size:12px;letter-spacing:1px;'>LAERSKOOL TYGERPOORT</div>");

            html.Append(
                "<h1 style='margin:6px 0 0 0;'>Daaglikse Logistieke Jobcard</h1>");

            html.Append("</div>");

            html.Append(
                "<div style='padding:24px;'>");

            html.Append(
                "<p><strong>Jobcard:</strong> " +
                Encode(card.JobCardNumber) +
                "</p>");

            html.Append(
                "<p><strong>Datum:</strong> " +
                Encode(
                    card.JobCardDate.ToString(
                        "dd MMMM yyyy")) +
                "</p>");

            html.Append(
                "<p><strong>Aantal take:</strong> " +
                items.Count +
                "</p>");

            var groups =
                items
                    .GroupBy(item =>
                        string.IsNullOrWhiteSpace(
                            item.WorkerName)
                            ? "Nog nie toegeken nie"
                            : item.WorkerName!)
                    .OrderBy(group =>
                        group.Key);

            foreach (var group in groups)
            {
                html.Append(
                    "<h2 style='border-bottom:2px solid #d7a31f;padding-bottom:8px;margin-top:28px;'>" +
                    Encode(group.Key) +
                    "</h2>");

                foreach (var item in group)
                {
                    html.Append(
                        "<div style='border:1px solid #dddddd;border-radius:8px;padding:15px;margin-bottom:12px;'>");

                    html.Append(
                        "<strong>" +
                        Encode(item.TaskDescription) +
                        "</strong>");

                    html.Append(
                        "<p><strong>Prioriteit:</strong> " +
                        Encode(item.Priority) +
                        "</p>");

                    if (!string.IsNullOrWhiteSpace(
                            item.Area))
                    {
                        html.Append(
                            "<p><strong>Area:</strong> " +
                            Encode(item.Area) +
                            "</p>");
                    }

                    if (!string.IsNullOrWhiteSpace(
                            item.MaterialsRequired))
                    {
                        html.Append(
                            "<p><strong>Materiaal:</strong> " +
                            Encode(item.MaterialsRequired) +
                            "</p>");
                    }

                    if (!string.IsNullOrWhiteSpace(
                            item.ManagerNote))
                    {
                        html.Append(
                            "<p><strong>Nota:</strong> " +
                            Encode(item.ManagerNote) +
                            "</p>");
                    }

                    html.Append(
                        "<p><strong>Status:</strong> " +
                        Encode(item.Status) +
                        "</p>");

                    html.Append("</div>");
                }
            }

            html.Append(
                "<p style='margin-top:30px;border-top:1px solid #dddddd;padding-top:15px;font-size:12px;color:#777777;'>");

            html.Append(
                "Hierdie jobcard is outomaties uit die Logistieke werkplan saamgestel.");

            html.Append("</p>");

            html.Append("</div>");
            html.Append("</div>");
            html.Append("</body></html>");

            return html.ToString();
        }

        // ============================================================
        // HTML ENCODE
        // ============================================================

        private static string Encode(
            string? value)
        {
            return WebUtility.HtmlEncode(
                value ?? string.Empty);
        }

        // ============================================================
        // PERMISSION
        // ============================================================

        private async Task<bool> CanManageLogistics()
        {
            if (User.IsInRole("3"))
            {
                return true;
            }

            int? userID =
                GetLoggedInUserID();

            if (!userID.HasValue)
            {
                return false;
            }

            return await _context.ModulePermissions
                .AnyAsync(permission =>
                    permission.UserID == userID.Value &&
                    permission.ModuleKey == "logistics" &&
                    (
                        permission.CanManage ||
                        permission.CanAdmin
                    ));
        }

        private int? GetLoggedInUserID()
        {
            string? claim =
                User.FindFirstValue(
                    ClaimTypes.NameIdentifier);

            if (!int.TryParse(
                    claim,
                    out int userID))
            {
                return null;
            }

            return userID;
        }
    }
}