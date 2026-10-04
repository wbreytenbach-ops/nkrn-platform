using System.Data;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NKRN.API.Data;
using NKRN.API.Models;
using NKRN.API.Services;

namespace NKRN.API.Controllers;

[ApiController]
[Authorize]
[Route("api/AI")]
public sealed class AiController : ControllerBase
{
    private readonly NkrnAiService _ai;
    private readonly ApplicationDbContext _context;

    public AiController(
        NkrnAiService ai,
        ApplicationDbContext context)
    {
        _ai = ai;
        _context = context;
    }

    [HttpGet("status")]
    public IActionResult Status() => Ok(_ai.GetPublicStatus());

    [HttpPost("help")]
    public async Task<ActionResult<AiTriageResult>> Help(
        [FromBody] AiHelpInput input,
        CancellationToken cancellationToken)
    {
        var userID = GetLoggedInUserID();

        if (userID == null)
        {
            return Unauthorized();
        }

        var description = input.Description?.Trim() ?? string.Empty;

        if (description.Length < 5)
        {
            return BadRequest(new
            {
                message = "Beskryf asseblief eers waarmee jy hulp nodig het."
            });
        }

        var module = NkrnAiService.NormaliseModule(input.ModuleKey);
        var categories = module switch
        {
            "IT" => await _context.Categories
                .AsNoTracking()
                .OrderBy(category => category.CategoryID)
                .Select(category => category.CategoryName)
                .ToListAsync(cancellationToken),

            "Logistics" => await LoadLogisticsMaintenanceCategoriesAsync(cancellationToken),

            _ => new List<string>()
        };

        var result = await _ai.StartHelpSessionAsync(
            userID.Value,
            new AiTriageRequest
            {
                ModuleKey = module,
                Description = description,
                AdditionalContext = input.AdditionalContext,
                AllowedCategories = categories,
                Conversation = input.Conversation ?? new()
            },
            cancellationToken);

        return Ok(result);
    }

    [HttpPost("it-help")]
    public Task<ActionResult<AiTriageResult>> ItHelp(
        [FromBody] AiHelpInput input,
        CancellationToken cancellationToken)
    {
        input.ModuleKey = "IT";
        return Help(input, cancellationToken);
    }

    [HttpPost("help/outcome")]
    public async Task<IActionResult> CompleteHelp(
        [FromBody] AiHelpOutcomeInput input,
        CancellationToken cancellationToken)
    {
        var userID = GetLoggedInUserID();

        if (userID == null)
        {
            return Unauthorized();
        }

        if (input.SessionID == Guid.Empty)
        {
            return BadRequest(new { message = "Ongeldige AI-hulpsessie." });
        }

        var saved = await _ai.TryCompleteHelpSessionAsync(
            userID.Value,
            input.SessionID,
            input.Outcome,
            input.RequestID,
            input.UserResponse,
            cancellationToken);

        return saved
            ? NoContent()
            : Ok(new
            {
                saved = false,
                message = "Die uitkoms kon nie gestoor word nie, maar die versoekvloei kan voortgaan."
            });
    }

    [Authorize(Roles = "2,3")]
    [HttpPost("analyse")]
    public async Task<ActionResult<AiTriageResult>> Analyse(
        [FromBody] AiTriageRequest input,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(input.Description))
        {
            return BadRequest(new { message = "’n Beskrywing is nodig." });
        }

        return Ok(await _ai.AnalyseAsync(input, cancellationToken));
    }

    private int? GetLoggedInUserID()
    {
        var value = User.FindFirstValue(ClaimTypes.NameIdentifier);
        return int.TryParse(value, out var userID) ? userID : null;
    }

    private async Task<List<string>> LoadLogisticsMaintenanceCategoriesAsync(
        CancellationToken cancellationToken)
    {
        var output = new List<string>();
        var connection = _context.Database.GetDbConnection();
        var shouldClose = connection.State != ConnectionState.Open;

        if (shouldClose)
        {
            await connection.OpenAsync(cancellationToken);
        }

        try
        {
            await using var command = connection.CreateCommand();
            command.CommandText = """
                SELECT MaintenanceName
                FROM dbo.LogisticsMaintenanceTypes
                WHERE IsActive = 1
                ORDER BY DisplayOrder, MaintenanceName;
                """;

            await using var reader = await command.ExecuteReaderAsync(cancellationToken);

            while (await reader.ReadAsync(cancellationToken))
            {
                if (!reader.IsDBNull(0))
                {
                    output.Add(reader.GetString(0));
                }
            }
        }
        finally
        {
            if (shouldClose && connection.State == ConnectionState.Open)
            {
                await connection.CloseAsync();
            }
        }

        return output;
    }
}
