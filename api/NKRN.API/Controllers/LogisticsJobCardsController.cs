using NKRN.API.Services;
using System.Security.Claims;
using NKRN.API.Data;
using NKRN.API.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace NKRN.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class LogisticsJobCardsController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        private readonly NKRN.API.Services.LogisticsJobCardService _cards;

        public LogisticsJobCardsController(
            ApplicationDbContext context, NKRN.API.Services.LogisticsJobCardService cards)
        {
            _context = context;
            _cards = cards;
        }

        // ============================================================
        // GET ALL JOB CARDS
        // ============================================================

        [HttpGet]
        public async Task<IActionResult> GetJobCards(
            [FromQuery] DateTime? date = null)
        {
            if (!await CanViewLogistics())
            {
                return Forbid();
            }

            var query = _context.LogisticsJobCards
                .AsNoTracking()
                .AsQueryable();

            if (date.HasValue)
            {
                DateTime selectedDate = date.Value.Date;

                query = query.Where(card =>
                    card.JobCardDate == selectedDate);
            }

            var cards = await query
                .OrderByDescending(card => card.JobCardDate)
                .ThenByDescending(card => card.GeneratedAt)
                .Select(card => new
                {
                    card.JobCardID,
                    card.JobCardNumber,
                    card.JobCardDate,
                    card.RecipientUserID,
                    card.RecipientEmail,
                    card.Status,
                    card.GeneratedAt,
                    card.SentAt,
                    card.GeneratedByUserID,
                    card.Notes,
                    card.DeliveryNote,

                    WorkerCount = _context.LogisticsJobCardItems.Where(i => i.JobCardID == card.JobCardID && i.WorkerID != null).Select(i => i.WorkerID).Distinct().Count(),
                    ItemCount =
                        _context.LogisticsJobCardItems.Count(item =>
                            item.JobCardID == card.JobCardID)
                })
                .ToListAsync();

            return Ok(cards);
        }

        // ============================================================
        // GET ONE JOB CARD
        // ============================================================

        [HttpGet("{id}")]
        public async Task<IActionResult> GetJobCard(int id)
        {
            if (!await CanViewLogistics())
            {
                return Forbid();
            }

            var card = await _context.LogisticsJobCards
                .AsNoTracking()
                .FirstOrDefaultAsync(card =>
                    card.JobCardID == id);

            if (card == null)
            {
                return NotFound(new
                {
                    message = "Logistics job card not found."
                });
            }

            var items = await _context.LogisticsJobCardItems
                .AsNoTracking()
                .Where(item =>
                    item.JobCardID == id)
                .OrderBy(item =>
                    item.SortOrder)
                .Select(item => new
                {
                    item.JobCardItemID,
                    item.WorkPlanItemID,
                    item.TaskID,
                    item.WorkerID,
                    item.WorkerName,
                    item.Area,
                    item.TaskDescription,
                    item.Priority,
                    item.MaterialsRequired,
                    item.ManagerNote,
                    item.Status,
                    item.SortOrder,
                    item.CompletedAt,
                    item.Notes, item.PlannedStart, item.PlannedEnd
                })
                .ToListAsync();

            return Ok(new
            {
                card.JobCardID,
                card.JobCardNumber,
                card.JobCardDate,
                card.RecipientUserID,
                card.RecipientEmail,
                card.Status,
                card.GeneratedAt,
                card.SentAt,
                card.GeneratedByUserID,
                card.Notes,
                    card.DeliveryNote,
                Items = items
            });
        }

        // ============================================================
        // GENERATE DAILY JOB CARD
        // ============================================================

        [HttpPost("generate")]
        public async Task<IActionResult> GenerateJobCard(
            [FromQuery] DateTime? date = null)
        {
            if (!await CanManageLogistics())
            {
                return Forbid();
            }

            try { return Ok(await _cards.GenerateAsync(date ?? LogisticsAutomationOptions.LocalNow(), GetLoggedInUserID())); }
            catch (InvalidOperationException ex) { return BadRequest(new { message = ex.Message }); }
        }

        // ============================================================
        // PERMISSIONS
        // ============================================================

        private async Task<bool> CanViewLogistics()
        {
            if (User.IsInRole("3"))
            {
                return true;
            }

            int? userID = GetLoggedInUserID();

            if (!userID.HasValue)
            {
                return false;
            }

            return await _context.ModulePermissions
                .AnyAsync(permission =>
                    permission.UserID == userID.Value &&
                    permission.ModuleKey == "logistics" &&
                    (
                        permission.CanView ||
                        permission.CanManage ||
                        permission.CanAdmin
                    ));
        }

        private async Task<bool> CanManageLogistics()
        {
            if (User.IsInRole("3"))
            {
                return true;
            }

            int? userID = GetLoggedInUserID();

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

        private static string BuildWorkerName(
            LogisticsWorker worker)
        {
            if (string.IsNullOrWhiteSpace(
                    worker.LastName))
            {
                return worker.FirstName;
            }

            return worker.FirstName +
                   " " +
                   worker.LastName;
        }
    }
}