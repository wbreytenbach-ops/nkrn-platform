using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Google.Apis.Auth;
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


        // Google Identity Services credential verification. Client ID is configured
        // on the API host, not bundled into source or frontend build.
        [HttpGet("google/config")]
        [AllowAnonymous]
        public IActionResult GoogleConfig()
        {
            var clientId = _configuration["GoogleAuth:ClientId"]?.Trim();
            if (string.IsNullOrWhiteSpace(clientId))
                return StatusCode(503, new { message = "Google sign-in has not been configured by IT." });
            return Ok(new { clientId });
        }

        [HttpPost("google")]
        [AllowAnonymous]
        public async Task<IActionResult> LoginWithGoogle([FromBody] GoogleLoginRequest input)
        {
            if (input == null || string.IsNullOrWhiteSpace(input.Credential))
                return BadRequest(new { message = "Google sign-in credential is required." });

            var clientId = _configuration["GoogleAuth:ClientId"]?.Trim();
            if (string.IsNullOrWhiteSpace(clientId))
                return StatusCode(503, new { message = "Google sign-in has not been configured by IT." });

            GoogleJsonWebSignature.Payload payload;
            try
            {
                payload = await GoogleJsonWebSignature.ValidateAsync(
                    input.Credential,
                    new GoogleJsonWebSignature.ValidationSettings
                    {
                        Audience = new[] { clientId },
                        HostedDomain = "tygies.co.za"
                    });
            }
            catch (Exception)
            {
                return Unauthorized(new { message = "Google sign-in could not be verified." });
            }

            var email = payload.Email?.Trim().ToLowerInvariant();
            if (string.IsNullOrWhiteSpace(payload.Subject) ||
                payload.EmailVerified != true ||
                string.IsNullOrWhiteSpace(email) ||
                !email.EndsWith("@tygies.co.za", StringComparison.OrdinalIgnoreCase) ||
                !string.Equals(payload.HostedDomain, "tygies.co.za", StringComparison.OrdinalIgnoreCase))
                return Unauthorized(new
                {
                    message = "Use your verified Tygerpoort Google Workspace account."
                });

            var user = await _context.Users.AsNoTracking().FirstOrDefaultAsync(u =>
                u.Email != null && u.Email.ToLower() == email && u.IsActive);
            if (user == null)
                return Unauthorized(new
                {
                    message = "Your account is not active in Tygies One. Contact IT."
                });

            return CreateTokenResponse(user);
        }

        // Never issue a JWT from a plain email, even for a pre-existing user.
        [HttpPost("login")]
        public IActionResult LegacyLogin() => StatusCode(410, new
        {
            message = "Email-only login is disabled. Use Sign in with Google."
        });

        private IActionResult CreateTokenResponse(User user)
        {
            var configuredJwtKey = _configuration["Jwt:Key"] ?? string.Empty;
            var configuredIssuer = _configuration["Jwt:Issuer"] ?? string.Empty;
            var configuredAudience = _configuration["Jwt:Audience"] ?? string.Empty;
            if (string.IsNullOrWhiteSpace(configuredJwtKey) ||
                string.IsNullOrWhiteSpace(configuredIssuer) ||
                string.IsNullOrWhiteSpace(configuredAudience))
                return StatusCode(503, new { message = "Authentication is not configured." });

            var key = new SymmetricSecurityKey(
                Encoding.UTF8.GetBytes(configuredJwtKey));
            var signing = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

            var firstName = user.FirstName ?? string.Empty;
            var lastName = user.LastName ?? string.Empty;
            var email = user.Email ?? string.Empty;
            var roleID = user.RoleID ?? 1;
            var claims = new List<Claim>
            {
                new Claim(ClaimTypes.NameIdentifier, user.UserID.ToString()),
                new Claim(ClaimTypes.Email, email),
                new Claim(ClaimTypes.GivenName, firstName),
                new Claim(ClaimTypes.Surname, lastName),
                new Claim(ClaimTypes.Role, roleID.ToString()),
                new Claim("nkrn_auth", "google_workspace"),
                new Claim("nkrn_auth_version", "2")
            };
            var token = new JwtSecurityToken(
                issuer: configuredIssuer,
                audience: configuredAudience,
                claims: claims,
                expires: DateTime.UtcNow.AddHours(8),
                signingCredentials: signing);

            return Ok(new
            {
                token = new JwtSecurityTokenHandler().WriteToken(token),
                user = new { userID = user.UserID, firstName, lastName, email, roleID }
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

    public class GoogleLoginRequest
    {
        public string Credential { get; set; } = string.Empty;
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
