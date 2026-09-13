using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using NKRN.API.Data;
using NKRN.API.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

namespace NKRN.API.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class AuthController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        private readonly IConfiguration _configuration;

        public AuthController(
            ApplicationDbContext context,
            IConfiguration configuration)
        {
            _context = context;
            _configuration = configuration;
        }

        // ============================================================
        // LOGIN
        // ============================================================

        [HttpPost("login")]
        public async Task<IActionResult> Login([FromBody] LoginRequest loginRequest)
        {
            if (loginRequest == null ||
                string.IsNullOrWhiteSpace(loginRequest.Email))
            {
                return BadRequest(new
                {
                    message = "Email address is required."
                });
            }

            string email = loginRequest.Email.Trim().ToLower();

            if (!email.EndsWith("@tygies.co.za"))
            {
                return Unauthorized(new
                {
                    message = "Only @tygies.co.za email addresses are allowed."
                });
            }

            var user = await _context.Users
                .FirstOrDefaultAsync(u =>
                    u.Email != null &&
                    u.Email.ToLower() == email);

            if (user == null)
            {
                return Unauthorized(new
                {
                    message = "No Tygerpoort IT Desk account was found for this email address."
                });
            }

            if (!user.IsActive)
            {
                return Unauthorized(new
                {
                    message =
                        "This account has been deactivated. Please contact an administrator."
                });
            }

            // ========================================================
            // NORMALISE POSSIBLY NULL DATABASE VALUES
            // ========================================================

            string userEmail = user.Email ?? string.Empty;
            string firstName = user.FirstName ?? string.Empty;
            string lastName = user.LastName ?? string.Empty;

            int userID = user.UserID;
            int roleID = user.RoleID ?? 1;

            // ========================================================
            // CREATE JWT
            // ========================================================

            string configuredJwtKey =
                _configuration["Jwt:Key"] ?? string.Empty;

            string configuredIssuer =
                _configuration["Jwt:Issuer"] ?? string.Empty;

            string configuredAudience =
                _configuration["Jwt:Audience"] ?? string.Empty;

            if (string.IsNullOrWhiteSpace(configuredJwtKey))
            {
                return StatusCode(500, new
                {
                    message = "JWT key has not been configured."
                });
            }

            if (string.IsNullOrWhiteSpace(configuredIssuer))
            {
                return StatusCode(500, new
                {
                    message = "JWT issuer has not been configured."
                });
            }

            if (string.IsNullOrWhiteSpace(configuredAudience))
            {
                return StatusCode(500, new
                {
                    message = "JWT audience has not been configured."
                });
            }

            var key = new SymmetricSecurityKey(
                Encoding.UTF8.GetBytes(configuredJwtKey));

            var credentials = new SigningCredentials(
                key,
                SecurityAlgorithms.HmacSha256);

            var claims = new List<Claim>
            {
                new Claim(
                    ClaimTypes.NameIdentifier,
                    userID.ToString()),

                new Claim(
                    ClaimTypes.Email,
                    userEmail),

                new Claim(
                    ClaimTypes.GivenName,
                    firstName),

                new Claim(
                    ClaimTypes.Surname,
                    lastName),

                new Claim(
                    ClaimTypes.Role,
                    roleID.ToString())
            };

            var token = new JwtSecurityToken(
                issuer: configuredIssuer,
                audience: configuredAudience,
                claims: claims,
                expires: DateTime.UtcNow.AddHours(8),
                signingCredentials: credentials);

            string tokenString =
                new JwtSecurityTokenHandler()
                    .WriteToken(token);

            // ========================================================
            // RETURN USER + TOKEN
            // ========================================================

            return Ok(new
            {
                token = tokenString,

                user = new
                {
                    userID = userID,
                    firstName = firstName,
                    lastName = lastName,
                    email = userEmail,
                    roleID = roleID
                }
            });
        }

        // ============================================================
        // GET USER BY EMAIL
        // ============================================================

        [HttpGet("user")]
        [Authorize(Roles = "3")]
        public async Task<IActionResult> GetUser(
            [FromQuery] string email)
        {
            if (string.IsNullOrWhiteSpace(email))
            {
                return BadRequest(new
                {
                    message = "Email address is required."
                });
            }

            string normalisedEmail =
                email.Trim().ToLower();

            var user = await _context.Users
                .FirstOrDefaultAsync(u =>
                    u.IsActive &&
                    u.Email != null &&
                    u.Email.ToLower() == normalisedEmail);

            if (user == null)
            {
                return NotFound(new
                {
                    message = "User not found."
                });
            }

            return Ok(new
            {
                userID = user.UserID,
                firstName = user.FirstName ?? string.Empty,
                lastName = user.LastName ?? string.Empty,
                email = user.Email ?? string.Empty,
                roleID = user.RoleID
            });
        }

        // ============================================================
        // CREATE USER
        // ============================================================

        [HttpPost("register")]
        [Authorize(Roles = "3")]
        public async Task<IActionResult> Register(
            [FromBody] RegisterRequest registerRequest)
        {
            if (registerRequest == null)
            {
                return BadRequest(new
                {
                    message = "User information is required."
                });
            }

            if (string.IsNullOrWhiteSpace(registerRequest.Email))
            {
                return BadRequest(new
                {
                    message = "Email address is required."
                });
            }

            if (string.IsNullOrWhiteSpace(registerRequest.FirstName))
            {
                return BadRequest(new
                {
                    message = "First name is required."
                });
            }

            if (string.IsNullOrWhiteSpace(registerRequest.LastName))
            {
                return BadRequest(new
                {
                    message = "Last name is required."
                });
            }

            string email =
                registerRequest.Email.Trim().ToLower();

            if (!email.EndsWith("@tygies.co.za"))
            {
                return BadRequest(new
                {
                    message =
                        "Only @tygies.co.za email addresses are allowed."
                });
            }

            var existingUser =
                await _context.Users
                    .FirstOrDefaultAsync(u =>
                        u.Email != null &&
                        u.Email.ToLower() == email);

            if (existingUser != null)
            {
                return Conflict(new
                {
                    message =
                        "A user with this email address already exists."
                });
            }

            if (registerRequest.RoleID is < 1 or > 3)
            {
                return BadRequest(new
                {
                    message =
                        "Invalid role. Use 1 for User, 2 for Technician or 3 for Admin."
                });
            }

            var user = new User
            {
                FirstName =
                    registerRequest.FirstName.Trim(),

                LastName =
                    registerRequest.LastName.Trim(),

                Email = email,

                RoleID =
                    registerRequest.RoleID <= 0
                        ? 1
                        : registerRequest.RoleID,

                CreatedDate = DateTime.Now,

                IsActive = true
            };

            _context.Users.Add(user);

            await _context.SaveChangesAsync();

            return CreatedAtAction(
                nameof(GetUser),
                new
                {
                    email = user.Email
                },
                new
                {
                    userID = user.UserID,
                    firstName = user.FirstName ?? string.Empty,
                    lastName = user.LastName ?? string.Empty,
                    email = user.Email ?? string.Empty,
                    roleID = user.RoleID
                });
        }
    }

    // ================================================================
    // LOGIN REQUEST MODEL
    // ================================================================

    public class LoginRequest
    {
        public string Email { get; set; } = string.Empty;
    }

    // ================================================================
    // REGISTER REQUEST MODEL
    // ================================================================

    public class RegisterRequest
    {
        public string FirstName { get; set; } = string.Empty;

        public string LastName { get; set; } = string.Empty;

        public string Email { get; set; } = string.Empty;

        public int RoleID { get; set; } = 1;
    }
}
