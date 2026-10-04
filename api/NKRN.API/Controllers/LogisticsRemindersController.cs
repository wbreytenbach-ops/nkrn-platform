using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NKRN.API.Data;
using NKRN.API.Services;

namespace NKRN.API.Controllers;

[ApiController]
[Authorize]
[Route("api/LogisticsReminders")]
public sealed class LogisticsRemindersController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly LogisticsReminderService _reminders;

    public LogisticsRemindersController(
        ApplicationDbContext context,
        LogisticsReminderService reminders)
    {
        _context = context;
        _reminders = reminders;
    }

    [HttpGet("due")]
    public async Task<IActionResult> Due(
        CancellationToken cancellationToken)
    {
        if (!await CanManageAsync())
        {
            return Forbid();
        }

        return Ok(
            await _reminders.PreviewDueAsync(
                DateTime.Today,
                cancellationToken));
    }

    [HttpPost("run")]
    public async Task<IActionResult> Run(
        CancellationToken cancellationToken)
    {
        if (!await CanManageAsync())
        {
            return Forbid();
        }

        return Ok(
            await _reminders.SendDueAsync(
                DateTime.Today,
                cancellationToken));
    }

    private async Task<bool> CanManageAsync()
    {
        var claim =
            User.FindFirstValue(
                ClaimTypes.NameIdentifier);

        if (!int.TryParse(
            claim,
            out var userID))
        {
            return false;
        }

        return await _context.Users
            .AnyAsync(
                user =>
                    user.UserID == userID &&
                    user.IsActive &&
                    (
                        user.RoleID == 3 ||
                        _context.ModulePermissions.Any(
                            permission =>
                                permission.UserID == userID &&
                                permission.ModuleKey.ToLower() ==
                                    "logistics" &&
                                permission.CanView &&
                                (
                                    permission.CanManage ||
                                    permission.CanAdmin
                                )
                        )
                    )
            );
    }
}
