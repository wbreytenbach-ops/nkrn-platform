using System.ComponentModel.DataAnnotations;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NKRN.API.Data;
using NKRN.API.Models;

namespace NKRN.API.Controllers;

[Route("api/[controller]")]
[ApiController]
[Authorize]
public sealed class RequestCommentsController(ApplicationDbContext context) : ControllerBase
{
    public sealed class CreateITCommentInput
    {
        [Required]
        public int RequestID { get; set; }

        [Required, StringLength(4000)]
        public string CommentText { get; set; } = string.Empty;

        // IDs come from the server-provided mention suggestions. The server
        // rechecks request access and ensures the comment mentions the user.
        public int[] MentionedUserIDs { get; set; } = [];
    }

    private int? ActorID => int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var id)
        ? id : null;

    private async Task<(Request? Request, User? Actor, bool IsStaff)> AuthorizeRequestAsync(int requestID)
    {
        if (ActorID is not int actorID) return (null, null, false);

        var actor = await context.Users.AsNoTracking()
            .FirstOrDefaultAsync(u => u.UserID == actorID && u.IsActive);
        if (actor == null) return (null, null, false);

        var request = await context.Requests.FindAsync(requestID);
        if (request == null) return (null, actor, false);

        var isStaff = actor.RoleID is 2 or 3;
        return (request.UserID == actorID || isStaff)
            ? (request, actor, isStaff)
            : (null, actor, isStaff);
    }

    [HttpGet("request/{requestID:int}")]
    public async Task<IActionResult> GetRequestComments(int requestID)
    {
        if (ActorID == null) return Unauthorized();

        var (request, actor, _) = await AuthorizeRequestAsync(requestID);
        if (actor == null) return Unauthorized();
        if (request == null) return NotFound();

        var messages = await context.RequestComments.AsNoTracking()
            .Include(c => c.User)
            .Where(c => c.RequestID == requestID)
            .OrderBy(c => c.CreatedDate).ThenBy(c => c.CommentID)
            .Select(c => new
            {
                c.CommentID,
                c.RequestID,
                c.UserID,
                c.CommentText,
                c.CreatedDate,
                user = new
                {
                    c.User!.UserID,
                    c.User.FirstName,
                    c.User.LastName
                }
            })
            .ToListAsync();

        return Ok(messages);
    }

    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetComment(int id)
    {
        if (ActorID == null) return Unauthorized();
        var comment = await context.RequestComments.AsNoTracking()
            .FirstOrDefaultAsync(c => c.CommentID == id);
        if (comment == null) return NotFound();

        var (request, actor, _) = await AuthorizeRequestAsync(comment.RequestID);
        if (actor == null) return Unauthorized();
        if (request == null) return NotFound();
        return Ok(comment);
    }

    // Suggestions only include people already authorized to see the request.
    // External IT contacts can be assigned by email but cannot receive
    // in-portal mentions while email login is restricted to @tygies.co.za.
    [HttpGet("mentionable/{requestID:int}")]
    public async Task<IActionResult> GetMentionableUsers(int requestID)
    {
        if (ActorID == null) return Unauthorized();
        var (request, actor, _) = await AuthorizeRequestAsync(requestID);
        if (actor == null) return Unauthorized();
        if (request == null) return NotFound();

        var users = await context.Users.AsNoTracking()
            .Where(u => u.IsActive && u.UserID != actor.UserID &&
                u.Email != null && u.Email.EndsWith("@tygies.co.za") &&
                (u.UserID == request.UserID || u.RoleID == 2 || u.RoleID == 3))
            .OrderBy(u => u.FirstName).ThenBy(u => u.LastName)
            .Select(u => new { u.UserID, u.FirstName, u.LastName, u.Email })
            .ToListAsync();

        return Ok(users);
    }

    [HttpPost]
    public async Task<IActionResult> CreateComment([FromBody] CreateITCommentInput input)
    {
        if (ActorID == null) return Unauthorized();
        if (input == null || input.RequestID <= 0 ||
            string.IsNullOrWhiteSpace(input.CommentText))
            return BadRequest(new { message = "Request and comment text are required." });
        if (input.CommentText.Trim().Length > 4000)
            return BadRequest(new { message = "Comment exceeds 4000 characters." });

        var (request, actor, _) = await AuthorizeRequestAsync(input.RequestID);
        if (actor == null) return Unauthorized();
        if (request == null) return NotFound();

        var requestedMentions = (input.MentionedUserIDs ?? [])
            .Distinct().ToList();
        if (requestedMentions.Count > 5)
            return BadRequest(new { message = "A message may mention at most five people." });

        var recipients = requestedMentions.Count == 0
            ? new List<User>()
            : await context.Users.AsNoTracking()
                .Where(u => requestedMentions.Contains(u.UserID) &&
                    u.UserID != actor.UserID && u.IsActive &&
                    u.Email != null && u.Email.EndsWith("@tygies.co.za") &&
                    (u.UserID == request.UserID || u.RoleID == 2 || u.RoleID == 3))
                .ToListAsync();

        if (requestedMentions.Count != recipients.Count)
            return BadRequest(new { message = "Mentioned user is not eligible for this request." });

        // A selected ID alone must not generate a notification: it has to
        // match the visible @mention in the posted message as well.
        var body = input.CommentText.Trim();
        foreach (var person in recipients)
        {
            var mention = $"@{person.FirstName} {person.LastName}";
            if (!body.Contains(mention, StringComparison.OrdinalIgnoreCase))
                return BadRequest(new { message = $"Message must include {mention}." });
        }

        await using var tx = await context.Database.BeginTransactionAsync();
        var comment = new RequestComment
        {
            RequestID = input.RequestID,
            UserID = actor.UserID,
            CommentText = body,
            CreatedDate = DateTime.UtcNow
        };
        context.RequestComments.Add(comment);
        await context.SaveChangesAsync();

        foreach (var person in recipients)
        {
            context.ITRequestMentions.Add(new ITRequestMention
            {
                CommentID = comment.CommentID,
                RequestID = input.RequestID,
                RecipientUserID = person.UserID,
                AuthorUserID = actor.UserID,
                CreatedAt = DateTime.UtcNow
            });
        }
        if (recipients.Count > 0) await context.SaveChangesAsync();
        await tx.CommitAsync();

        var saved = await context.RequestComments.AsNoTracking()
            .Where(c => c.CommentID == comment.CommentID)
            .Select(c => new
            {
                c.CommentID,
                c.RequestID,
                c.UserID,
                c.CommentText,
                c.CreatedDate,
                user = new { actor.UserID, actor.FirstName, actor.LastName }
            }).FirstAsync();

        return CreatedAtAction(nameof(GetComment), new { id = comment.CommentID }, saved);
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> DeleteComment(int id)
    {
        if (ActorID == null) return Unauthorized();
        var actor = await context.Users.AsNoTracking()
            .FirstOrDefaultAsync(u => u.UserID == ActorID && u.IsActive);
        if (actor?.RoleID is not (2 or 3)) return Forbid();

        var comment = await context.RequestComments.FindAsync(id);
        if (comment == null) return NotFound();

        // Notifications are automatically deleted by the Comment FK cascade.
        context.RequestComments.Remove(comment);
        await context.SaveChangesAsync();
        return NoContent();
    }
}
