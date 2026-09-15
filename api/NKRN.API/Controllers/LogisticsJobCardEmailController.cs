using System.Security.Claims;
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
        private readonly LogisticsJobCardService _cards;

        public LogisticsJobCardEmailController(
            ApplicationDbContext context,
            LogisticsJobCardService cards)
        {
            _context = context;
            _cards = cards;
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

            try { return Ok(await _cards.SendAsync(id)); }
            catch (InvalidOperationException ex) { return Conflict(new { message = ex.Message }); }
        }

        public record DeliveryReview(bool ConfirmedDelivered, bool ConfirmedNotDelivered);

        // A stuck Sending claim can only be resolved after a manager checks actual delivery.
        [HttpPost("{id}/delivery-review")]
        public async Task<IActionResult> ReviewDelivery(int id, [FromBody] DeliveryReview review)
        {
            if (!await CanManageLogistics()) return Forbid();
            if (review.ConfirmedDelivered == review.ConfirmedNotDelivered)
                return BadRequest(new { message = "Bevestig presies een afleweringsuitkoms." });
            var query = _context.LogisticsJobCards.Where(c => c.JobCardID == id && c.SentAt == null &&
                (c.Status == "Sending" || c.Status == "Failed"));
            // Never release a live in-flight claim. A manager must stop delivery processing first;
            // SendAsync holds this same per-card SQL application lock across SMTP and state commit.
            await using var transaction = await _context.Database.BeginTransactionAsync();
            await _context.Database.ExecuteSqlInterpolatedAsync($"DECLARE @r int; EXEC @r = sp_getapplock @Resource={"NKRN:Logistics:send:" + id}, @LockMode='Exclusive', @LockOwner='Transaction', @LockTimeout=0; IF @r < 0 THROW 51000, 'Delivery is still in progress', 1;");
            var note = $"Aflewering deur gebruiker #{GetLoggedInUserID()} hersien op {DateTime.UtcNow:O}.";
            var changed = review.ConfirmedDelivered
                ? await query.ExecuteUpdateAsync(set => set.SetProperty(c => c.Status, "Sent").SetProperty(c => c.SentAt, DateTime.UtcNow).SetProperty(c => c.DeliveryNote, note))
                : await query.ExecuteUpdateAsync(set => set.SetProperty(c => c.Status, "Generated").SetProperty(c => c.DeliveryNote, note + " Nie afgelewer nie; handmatige herstuur toegelaat."));
            await transaction.CommitAsync();
            return changed == 1 ? Ok(new { message = "Afleweringshersiening gestoor." }) : Conflict(new { message = "Hierdie kaart benodig nie afleweringshersiening nie." });
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