using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using System.Net;
using NKRN.API.Services;
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
        private readonly EmailService _email;
        private readonly EmailLoginChallengeStore _challenges;

        public AuthController(
            ApplicationDbContext context,
            IConfiguration configuration,
            EmailService email,
            EmailLoginChallengeStore challenges)
        {
            _context = context;
            _configuration = configuration;
            _email = email;
            _challenges = challenges;
        }

        // ============================================================
        // LOGIN
        // ============================================================

        [HttpPost("login")]
        public async Task<IActionResult> Login([FromBody] LoginRequest loginRequest)
        {
            if (loginRequest == null || string.IsNullOrWhiteSpace(loginRequest.Email))
                return BadRequest(new { message = "Email address is required." });

            var email = loginRequest.Email.Trim().ToLowerInvariant();
            if (!email.EndsWith("@tygies.co.za", StringComparison.OrdinalIgnoreCase))
                return Unauthorized(new { message = "Only @tygies.co.za email addresses are allowed." });

            var user = await _context.Users.AsNoTracking().FirstOrDefaultAsync(u =>
                u.Email != null && u.Email.ToLower() == email && u.IsActive);

            // Do not disclose whether an account exists to unauthenticated visitors.
            if (user == null)
                return Ok(new
                {
                    requiresVerification = true,
                    challengeId = Guid.NewGuid().ToString("D"),
                    message = "If your account is active, a verification code has been emailed."
                });

            if (!_challenges.TryCreate(email, out var challengeId, out var code))
                return StatusCode(429, new
                {
                    message = "Too many sign-in codes requested. Please try again in 10 minutes."
                });

            try
            {
                var safeEmail = WebUtility.HtmlEncode(email);
                await _email.SendEmailAsync(
                    email,
                    "Tygies One - your sign-in code / Aanmeldkode",
                    $"""
                    <html><body style="font-family:Arial,sans-serif;color:#222">
                    <h2>Tygies One</h2>
                    <p>Your verification code / Jou verifikasiekode:</p>
                    <p style="font-size:28px;font-weight:bold;letter-spacing:5px">{code}</p>
                    <p>This code expires in 5 minutes. Never share it.</p>
                    <p>Hierdie kode verval oor 5 minute. Moenie dit deel nie.</p>
                    <p>Account: {safeEmail}</p>
                    <p>If you did not request this code, ignore this email.</p>
                    </body></html>
                    """);
            }
            catch
            {
                _challenges.Revoke(challengeId);
                // Do not disclose SMTP credentials or internal failure details.
                return StatusCode(503, new
                {
                    message = "Sign-in email is unavailable. Contact IT support."
                });
            }

            return Ok(new
            {
                requiresVerification = true,
                challengeId = challengeId.ToString("D"),
                message = "Enter the 6-digit code sent to your Tygerpoort email."
            });
        }

        [HttpPost("verify")]
        public async Task<IActionResult> Verify([FromBody] VerifyLoginCodeRequest input)
        {
            if (input == null ||
                string.IsNullOrWhiteSpace(input.Email) ||
                string.IsNullOrWhiteSpace(input.Code) ||
                input.Code.Length != 6 ||
                !Guid.TryParse(input.ChallengeId, out var challengeId))
                return BadRequest(new { message = "A valid email and 6-digit code are required." });

            var email = input.Email.Trim().ToLowerInvariant();
            if (!email.EndsWith("@tygies.co.za", StringComparison.OrdinalIgnoreCase) ||
                !_challenges.TryVerify(challengeId, email, input.Code))
                return Unauthorized(new { message = "Code invalid or expired. Request a new code." });

            var user = await _context.Users.AsNoTracking().FirstOrDefaultAsync(u =>
                u.Email != null && u.Email.ToLower() == email && u.IsActive);
            if (user == null) return Unauthorized();

            var configuredJwtKey = _configuration["Jwt:Key"] ?? string.Empty;
            var configuredIssuer = _configuration["Jwt:Issuer"] ?? string.Empty;
            var configuredAudience = _configuration["Jwt:Audience"] ?? string.Empty;
            if (string.IsNullOrWhiteSpace(configuredJwtKey) ||
                string.IsNullOrWhiteSpace(configuredIssuer) ||
                string.IsNullOrWhiteSpace(configuredAudience))
                return StatusCode(500, new { message = "Authentication has not been configured." });

            var userEmail = user.Email ?? string.Empty;
            var firstName = user.FirstName ?? string.Empty;
            var lastName = user.LastName ?? string.Empty;
            var roleID = user.RoleID ?? 1;
            var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(configuredJwtKey));
            var credentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
            var claims = new List<Claim>
            {
                new Claim(ClaimTypes.NameIdentifier, user.UserID.ToString()),
                new Claim(ClaimTypes.Email, userEmail),
                new Claim(ClaimTypes.GivenName, firstName),
                new Claim(ClaimTypes.Surname, lastName),
                new Claim(ClaimTypes.Role, roleID.ToString()),
                // Old tokens without verified identity become invalid.
                new Claim("nkrn_auth", "email_otp")
            };
            var token = new JwtSecurityToken(
                issuer: configuredIssuer,
                audience: configuredAudience,
                claims: claims,
                expires: DateTime.UtcNow.AddHours(8),
                signingCredentials: credentials);

            return Ok(new
            {
                token = new JwtSecurityTokenHandler().WriteToken(token),
                user = new
                {
                    userID = user.UserID,
                    firstName,
                    lastName,
                    email = userEmail,
                    roleID
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

    public class VerifyLoginCodeRequest
    {
        public string Email { get; set; } = string.Empty;
        public string ChallengeId { get; set; } = string.Empty;
        public string Code { get; set; } = string.Empty;
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
