using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NKRN.API.Data;

namespace NKRN.API.Controllers;

[ApiController]
[Authorize]
[Route("api/ITNotifications")]
public sealed class ITNotificationsController(ApplicationDbContext context) : ControllerBase
{
    private int? ActorID => int.TryParse(
        User.FindFirstValue(ClaimTypes.NameIdentifier), out var id) ? id : null;

    [HttpGet]
    public async Task<IActionResult> GetNotifications()
    {
        if (ActorID is not int actorID) return Unauthorized();
        var user = await context.Users.AsNoTracking()
            .FirstOrDefaultAsync(u => u.UserID == actorID && u.IsActive);
        if (user == null) return Unauthorized();

        var staff = user.RoleID is 2 or 3;
        var entries = await (
            from notice in context.ITRequestMentions.AsNoTracking()
            join comment in context.RequestComments.AsNoTracking()
                on notice.CommentID equals comment.CommentID
            join request in context.Requests.AsNoTracking()
                on comment.RequestID equals request.RequestID
            join author in context.Users.AsNoTracking()
                on notice.AuthorUserID equals author.UserID
            where notice.RecipientUserID == actorID &&
                  (staff || request.UserID == actorID)
            orderby notice.CreatedAt descending, notice.NotificationID descending
            select new
            {
                notice.NotificationID,
                notice.RequestID,
                notice.CommentID,
                notice.CreatedAt,
                notice.ReadAt,
                authorName = author.FirstName + " " + author.LastName,
                requestTitle = request.Title,
                commentText = comment.CommentText
            })
            .Take(30).ToListAsync();

        var unread = await (
            from notice in context.ITRequestMentions.AsNoTracking()
            join request in context.Requests.AsNoTracking()
                on notice.RequestID equals request.RequestID
            where notice.RecipientUserID == actorID && notice.ReadAt == null &&
                  (staff || request.UserID == actorID)
            select notice.NotificationID
        ).CountAsync();

        return Ok(new { unreadCount = unread, notifications = entries });
    }

    [HttpPost("{id:int}/read")]
    public async Task<IActionResult> MarkRead(int id)
    {
        if (ActorID is not int actorID) return Unauthorized();

        var user = await context.Users.AsNoTracking()
            .FirstOrDefaultAsync(u => u.UserID == actorID && u.IsActive);
        if (user == null) return Unauthorized();

        var notice = await context.ITRequestMentions
            .FirstOrDefaultAsync(n => n.NotificationID == id && n.RecipientUserID == actorID);
        if (notice == null) return NotFound();

        var access = await context.Requests.AsNoTracking().AnyAsync(
            r => r.RequestID == notice.RequestID &&
                (r.UserID == actorID || user.RoleID == 2 || user.RoleID == 3));
        if (!access) return NotFound();

        if (notice.ReadAt == null)
        {
            notice.ReadAt = DateTime.UtcNow;
            await context.SaveChangesAsync();
        }

        return NoContent();
    }
}
