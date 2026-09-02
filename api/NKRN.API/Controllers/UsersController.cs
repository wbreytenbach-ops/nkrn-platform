using NKRN.API.Data;
using NKRN.API.Models;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace NKRN.API.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class UsersController : ControllerBase
    {
        private readonly ApplicationDbContext _context;

        public UsersController(ApplicationDbContext context)
        {
            _context = context;
        }

        // ========================================
        // GET ALL USERS
        // ========================================

        [HttpGet]
        [Authorize(Roles = "3")]
        public async Task<IActionResult> GetUsers()
        {
            var users = await _context.Users
                .Where(u => u.IsActive)
                .OrderBy(u => u.FirstName)
                .ThenBy(u => u.LastName)
                .ToListAsync();

            return Ok(users);
        }

        // ========================================
        // GET USER BY EMAIL
        // ========================================

        [HttpGet("email/{email}")]
        [Authorize(Roles = "3")]
        public async Task<IActionResult> GetUserByEmail(string email)
        {
            var user = await _context.Users
                .FirstOrDefaultAsync(u =>
                    u.IsActive && u.Email == email);

            if (user == null)
            {
                return NotFound(new
                {
                    message = "User not found"
                });
            }

            return Ok(user);
        }

        // ========================================
        // GET TECHNICIANS AND ADMINS
        // ========================================

        [HttpGet("technicians")]
        [Authorize(Roles = "2,3")]
        public async Task<IActionResult> GetTechnicians()
        {
            var users = await _context.Users
                .Where(u =>
                    u.IsActive &&
                    (u.RoleID == 2 || u.RoleID == 3))
                .OrderBy(u => u.FirstName)
                .ThenBy(u => u.LastName)
                .ToListAsync();

            return Ok(users);
        }

        // ========================================
        // CREATE NEW USER
        // ========================================

        [HttpPost]
        [Authorize(Roles = "3")]
        public async Task<IActionResult> CreateUser(User user)
        {
            if (string.IsNullOrWhiteSpace(user.FirstName))
            {
                return BadRequest(new
                {
                    message = "First name is required."
                });
            }

            if (string.IsNullOrWhiteSpace(user.LastName))
            {
                return BadRequest(new
                {
                    message = "Last name is required."
                });
            }

            if (string.IsNullOrWhiteSpace(user.Email))
            {
                return BadRequest(new
                {
                    message = "Email address is required."
                });
            }

            if (!user.Email.EndsWith(
                "@tygies.co.za",
                StringComparison.OrdinalIgnoreCase))
            {
                return BadRequest(new
                {
                    message =
                        "Only @tygies.co.za email addresses are allowed."
                });
            }

            var existingUser = await _context.Users
                .FirstOrDefaultAsync(
                    u => u.Email == user.Email
                );

            if (existingUser != null)
            {
                return Conflict(new
                {
                    message =
                        "A user with this email address already exists."
                });
            }

            if (
                user.RoleID != 1 &&
                user.RoleID != 2 &&
                user.RoleID != 3
            )
            {
                return BadRequest(new
                {
                    message =
                        "Invalid role. Use 1 for User, 2 for Technician or 3 for Admin."
                });
            }

            user.CreatedDate = DateTime.Now;
            user.IsActive = true;

            _context.Users.Add(user);

            await _context.SaveChangesAsync();

            return CreatedAtAction(
                nameof(GetUserByEmail),
                new
                {
                    email = user.Email
                },
                user
            );
        }

        // ========================================
        // UPDATE USER
        // ========================================

        [HttpPut("{id}")]
        [Authorize(Roles = "3")]
        public async Task<IActionResult> UpdateUser(
            int id,
            User user)
        {
            if (id != user.UserID)
            {
                return BadRequest(new
                {
                    message = "User ID does not match."
                });
            }

            var existingUser = await _context.Users
                .FirstOrDefaultAsync(u =>
                    u.UserID == id && u.IsActive);

            if (existingUser == null)
            {
                return NotFound(new
                {
                    message = "User not found."
                });
            }

            if (string.IsNullOrWhiteSpace(user.Email))
            {
                return BadRequest(new
                {
                    message = "Email address is required."
                });
            }

            if (!user.Email.EndsWith(
                "@tygies.co.za",
                StringComparison.OrdinalIgnoreCase))
            {
                return BadRequest(new
                {
                    message =
                        "Only @tygies.co.za email addresses are allowed."
                });
            }

            if (
                user.RoleID != 1 &&
                user.RoleID != 2 &&
                user.RoleID != 3
            )
            {
                return BadRequest(new
                {
                    message = "Invalid role."
                });
            }

            existingUser.FirstName = user.FirstName;
            existingUser.LastName = user.LastName;
            existingUser.Email = user.Email;
            existingUser.RoleID = user.RoleID;

            await _context.SaveChangesAsync();

            return Ok(existingUser);
        }

        // ========================================
        // DEACTIVATE USER
        // ========================================

        [HttpDelete("{id}")]
        [Authorize(Roles = "3")]
        public async Task<IActionResult> DeleteUser(int id)
        {
            var user = await _context.Users
                .FirstOrDefaultAsync(u =>
                    u.UserID == id && u.IsActive);

            if (user == null)
            {
                return NotFound(new
                {
                    message = "User not found."
                });
            }

            var currentUserId = User.FindFirstValue(
                ClaimTypes.NameIdentifier);

            if (currentUserId == id.ToString())
            {
                return BadRequest(new
                {
                    message = "You cannot deactivate your own account."
                });
            }

            user.IsActive = false;

            await _context.SaveChangesAsync();

            return NoContent();
        }

        // ========================================
        // TEST DATABASE CONNECTION
        // ========================================

        [HttpGet("testconnection")]
        [Authorize(Roles = "3")]
        public IActionResult TestConnection()
        {
            try
            {
                var connection =
                    _context.Database.GetDbConnection();

                connection.Open();

                var result = new
                {
                    Server = connection.DataSource,
                    Database = connection.Database,
                    State = connection.State.ToString()
                };

                connection.Close();

                return Ok(result);
            }
            catch (Exception ex)
            {
                return BadRequest(ex.Message);
            }
        }
    }
}
