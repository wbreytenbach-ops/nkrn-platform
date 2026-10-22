using System.Security.Claims;
using NKRN.API.Data;
using NKRN.API.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace NKRN.API.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class RequestCommentsController : ControllerBase
    {
        private readonly ApplicationDbContext _context;

        public RequestCommentsController(ApplicationDbContext context)
        {
            _context = context;
        }

        // ========================================
        // GET COMMENTS FOR A REQUEST
        // ========================================

        [HttpGet("request/{requestID}")]
        public async Task<IActionResult> GetRequestComments(int requestID)
        {
            var loggedInUserID = GetLoggedInUserID();

            if (loggedInUserID == null)
            {
                return Unauthorized();
            }

            var request = await _context.Requests
                .FindAsync(requestID);

            if (request == null)
            {
                return NotFound(new
                {
                    message = "The requested IT request does not exist."
                });
            }

            var isTechnicianOrAdmin =
                User.IsInRole("2") ||
                User.IsInRole("3");

            if (!isTechnicianOrAdmin &&
                request.UserID != loggedInUserID.Value)
            {
                return Forbid();
            }

            var comments = await _context.RequestComments
                .Include(c => c.User)
                .Where(c => c.RequestID == requestID)
                .OrderBy(c => c.CreatedDate)
                .ToListAsync();

            return Ok(comments);
        }

        // ========================================
        // GET ONE COMMENT
        // ========================================

        [HttpGet("{id}")]
        public async Task<IActionResult> GetComment(int id)
        {
            var comment = await _context.RequestComments
                .Include(c => c.User)
                .FirstOrDefaultAsync(c => c.CommentID == id);

            if (comment == null)
            {
                return NotFound(new
                {
                    message = "Comment not found."
                });
            }

            var loggedInUserID = GetLoggedInUserID();

            if (loggedInUserID == null)
            {
                return Unauthorized();
            }

            var request = await _context.Requests
                .FindAsync(comment.RequestID);

            if (request == null)
            {
                return NotFound(new
                {
                    message = "The requested IT request does not exist."
                });
            }

            var isTechnicianOrAdmin =
                User.IsInRole("2") ||
                User.IsInRole("3");

            if (!isTechnicianOrAdmin &&
                request.UserID != loggedInUserID.Value)
            {
                return Forbid();
            }

            return Ok(comment);
        }

        // ========================================
        // CREATE COMMENT
        // ========================================

        [HttpPost]
        public async Task<IActionResult> CreateComment(
            [FromBody] RequestComment comment)
        {
            var loggedInUserID = GetLoggedInUserID();

            if (loggedInUserID == null)
            {
                return Unauthorized();
            }

            if (comment.RequestID <= 0)
            {
                return BadRequest(new
                {
                    message = "A valid RequestID is required."
                });
            }

            if (string.IsNullOrWhiteSpace(comment.CommentText))
            {
                return BadRequest(new
                {
                    message = "Comment text is required."
                });
            }

            // ========================================
            // CHECK REQUEST EXISTS
            // ========================================

            var request = await _context.Requests
                .FindAsync(comment.RequestID);

            if (request == null)
            {
                return NotFound(new
                {
                    message = "The requested IT request does not exist."
                });
            }

            // ========================================
            // CHECK USER HAS ACCESS TO REQUEST
            // ========================================

            var isTechnicianOrAdmin =
                User.IsInRole("2") ||
                User.IsInRole("3");

            if (!isTechnicianOrAdmin &&
                request.UserID != loggedInUserID.Value)
            {
                return Forbid();
            }

            // ========================================
            // NEVER TRUST USERID FROM THE BROWSER
            // ========================================

            comment.UserID = loggedInUserID.Value;

            // ========================================
            // SET DATE ON SERVER
            // ========================================

            comment.CreatedDate = DateTime.Now;

            // ========================================
            // SAVE COMMENT
            // ========================================

            _context.RequestComments.Add(comment);

            await _context.SaveChangesAsync();

            // ========================================
            // LOAD SAVED COMMENT WITH USER
            // ========================================

            var savedComment = await _context.RequestComments
                .Include(c => c.User)
                .FirstOrDefaultAsync(
                    c => c.CommentID == comment.CommentID
                );

            return CreatedAtAction(
                nameof(GetComment),
                new
                {
                    id = comment.CommentID
                },
                savedComment
            );
        }

        // ========================================
        // DELETE COMMENT
        // TECHNICIAN + ADMIN ONLY
        // ========================================

        [Authorize(Roles = "2,3")]
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteComment(int id)
        {
            var comment = await _context.RequestComments
                .FindAsync(id);

            if (comment == null)
            {
                return NotFound(new
                {
                    message = "Comment not found."
                });
            }

            _context.RequestComments.Remove(comment);

            await _context.SaveChangesAsync();

            return NoContent();
        }

        // ========================================
        // GET LOGGED-IN USER ID FROM JWT
        // ========================================

        private int? GetLoggedInUserID()
        {
            var userIDClaim =
                User.FindFirst(
                    ClaimTypes.NameIdentifier
                )?.Value;

            if (int.TryParse(
                userIDClaim,
                out var userID))
            {
                return userID;
            }

            return null;
        }
    }
}