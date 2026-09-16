using System.ComponentModel.DataAnnotations;
using System.Data;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NKRN.API.Data;
using NKRN.API.Models;
using NKRN.API.Services;

namespace NKRN.API.Controllers;

[ApiController, Authorize, Route("api/LogisticsRequests")]
public class LogisticsRequestCollaborationController(ApplicationDbContext db, LogisticsRequestNotificationService notifications) : ControllerBase
{
    private int? Actor => int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var id) ? id : null;
    private async Task<bool> ManagerAsync() => Actor is int id && await db.Users.AnyAsync(u => u.UserID == id && u.IsActive &&
        (u.RoleID == 3 || db.ModulePermissions.Any(p => p.UserID == id && p.ModuleKey.ToLower() == "logistics" && p.CanView && (p.CanManage || p.CanAdmin))));

    private async Task<bool> CanReadAsync(int id)
    {
        if (Actor is not int userID || !await db.Users.AnyAsync(u => u.UserID == userID && u.IsActive)) return false;
        var manager = await ManagerAsync();
        var connection = db.Database.GetDbConnection();
        var close = connection.State != ConnectionState.Open;
        if (close) await connection.OpenAsync();
        try
        {
            await using var command = connection.CreateCommand();
            command.CommandText = "SELECT COUNT(*) FROM dbo.LogisticsRequests WHERE RequestID=@id AND IsDeleted=0 AND (@manager=1 OR RequestedByUserID=@userID);";
            foreach (var (name,value) in new (string,object)[] {("@id",id),("@manager",manager),("@userID",userID)}) {
                var p=command.CreateParameter(); p.ParameterName=name; p.Value=value; command.Parameters.Add(p);
            }
            return Convert.ToInt32(await command.ExecuteScalarAsync()) == 1;
        }
        finally { if (close) await connection.CloseAsync(); }
    }

    public record CommentInput([property: Required, StringLength(4000)] string Body);

    [HttpGet("{id:int}/comments")]
    public async Task<IActionResult> Comments(int id)
    {
        if (!await CanReadAsync(id)) return NotFound();
        var connection = db.Database.GetDbConnection();
        var close = connection.State != ConnectionState.Open;
        if (close) await connection.OpenAsync();
        try {
            await using var command = connection.CreateCommand();
            command.CommandText = """
                SELECT C.CommentID, C.Body, C.CreatedAt, U.FirstName, U.LastName
                FROM dbo.LogisticsRequestComments C JOIN dbo.Users U ON U.UserID=C.UserID
                WHERE C.RequestID=@id ORDER BY C.CommentID;
                """;
            var p=command.CreateParameter(); p.ParameterName="@id"; p.Value=id; command.Parameters.Add(p);
            var output=new List<object>();
            await using var reader=await command.ExecuteReaderAsync();
            while (await reader.ReadAsync()) output.Add(new { commentID=reader.GetInt32(0), body=reader.GetString(1),
                createdAt=DateTime.SpecifyKind(reader.GetDateTime(2),DateTimeKind.Utc),
                author=$"{reader.GetString(3)} {reader.GetString(4)}".Trim() });
            return Ok(output);
        }
        finally { if (close) await connection.CloseAsync(); }
    }

    [HttpPost("{id:int}/comments")]
    public async Task<IActionResult> AddComment(int id, CommentInput input)
    {
        if (string.IsNullOrWhiteSpace(input.Body)) return BadRequest(new {message="A comment is required."});
        if (!await CanReadAsync(id)) return NotFound();
        var actor=Actor!.Value;
        var body=input.Body.Trim();
        var affected=await db.Database.ExecuteSqlInterpolatedAsync($"""
            INSERT dbo.LogisticsRequestComments(RequestID,UserID,Body)
            SELECT RequestID,{actor},{body} FROM dbo.LogisticsRequests WHERE RequestID={id} AND IsDeleted=0;
            """);
        if (affected==0) return NotFound();
        await notifications.NotifyByIDAsync(id, "Logistics: Nuwe kommentaar / New comment");
        return NoContent();
    }

    [HttpPut("{id:int}")]
    public async Task<IActionResult> Edit(int id, CreateLogisticsRequestRequest input)
    {
        if (!await ManagerAsync()) return Forbid();
        if (string.IsNullOrWhiteSpace(input.Description) || string.IsNullOrWhiteSpace(input.Title))
            return BadRequest(new {message="Title and description are required."});
        if (!new[]{"Event","Maintenance","General"}.Contains(input.RequestType)) return BadRequest(new {message="Invalid request type."});
        if (input.StartTime.HasValue && input.EndTime.HasValue && input.EndTime <= input.StartTime) return BadRequest(new {message="End time must be after start time."});
        if (input.Equipment.Any(i=>i.EquipmentTypeID<=0 || i.Quantity<=0) || input.MaintenanceItems.Any(i=>i.MaintenanceTypeID<=0 || !new[]{"Repair","Replace","Unsure"}.Contains(i.ActionType)))
            return BadRequest(new {message="Invalid equipment or maintenance selection."});
        await using var transaction=await db.Database.BeginTransactionAsync();
        var changed=await db.Database.ExecuteSqlInterpolatedAsync($"""
            UPDATE dbo.LogisticsRequests SET Title={input.Title.Trim()}, Description={input.Description.Trim()},
                RequestType={input.RequestType}, ActivityCategory={input.ActivityCategory}, ActivityDate={input.ActivityDate},
                StartTime={input.StartTime}, EndTime={input.EndTime}, CleanupNextDay={input.CleanupNextDay}, UpdatedDate=SYSDATETIME()
            WHERE RequestID={id} AND IsDeleted=0;
            """);
        if(changed==0) return NotFound();
        await db.Database.ExecuteSqlInterpolatedAsync($"DELETE FROM dbo.LogisticsRequestLocations WHERE RequestID={id}; DELETE FROM dbo.LogisticsRequestEquipment WHERE RequestID={id}; DELETE FROM dbo.LogisticsRequestMaintenanceItems WHERE RequestID={id};");
        foreach(var item in input.Locations)
            await db.Database.ExecuteSqlInterpolatedAsync($"INSERT dbo.LogisticsRequestLocations(RequestID,LocationID,LocationText,IsPrimary) VALUES({id},{item.LocationID},{item.LocationText},{item.IsPrimary});");
        foreach(var item in input.Equipment)
            await db.Database.ExecuteSqlInterpolatedAsync($"INSERT dbo.LogisticsRequestEquipment(RequestID,EquipmentTypeID,Quantity,Notes) VALUES({id},{item.EquipmentTypeID},{item.Quantity},{item.Notes});");
        foreach(var item in input.MaintenanceItems)
            await db.Database.ExecuteSqlInterpolatedAsync($"INSERT dbo.LogisticsRequestMaintenanceItems(RequestID,MaintenanceTypeID,ActionType,Notes) VALUES({id},{item.MaintenanceTypeID},{item.ActionType},{item.Notes});");
        var actor=Actor!.Value;
        await db.Database.ExecuteSqlInterpolatedAsync($"INSERT dbo.LogisticsRequestComments(RequestID,UserID,Body) VALUES({id},{actor},{"Versoekbesonderhede gewysig / Request details edited."});");
        await transaction.CommitAsync();
        await transaction.DisposeAsync();
        await notifications.NotifyByIDAsync(id,"Logistics: Versoek gewysig / Request updated");
        return NoContent();
    }
}
