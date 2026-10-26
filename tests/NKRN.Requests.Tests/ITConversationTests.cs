using System.Net;
using System.Net.Http.Json;
using Microsoft.Extensions.DependencyInjection;
using NKRN.API.Data;
using NKRN.API.Models;
using Xunit;

namespace NKRN.Requests.Tests;

public class ITConversationTests
{
    private static void Seed(TestApp app)
    {
        using var scope = app.Server.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        db.Users.Add(new User {
            UserID = 7, FirstName = "Staff", LastName = "Sample",
            Email = "staff@tygies.co.za", RoleID = 1, IsActive = true
        });
        db.Requests.Add(new Request {
            RequestID = 71, UserID = 7, Title = "Printer problem",
            Description = "Please help", StatusID = 1, Priority = "Medium",
            AssignedTo = 3
        });
        db.SaveChanges();
    }

    [Fact]
    public async Task Technician_comment_uses_commentText_and_authenticated_actor()
    {
        using var app = new TestApp();
        Seed(app);

        var posted = await app.Send(HttpMethod.Post, "/api/RequestComments",
            new {
                requestID = 71, userID = 1,
                commentText = "Printer checked. Awaiting part."
            }, userID: 3, roleID: 2);
        Assert.Equal(HttpStatusCode.Created, posted.StatusCode);

        var saved = await posted.Content.ReadFromJsonAsync<System.Text.Json.JsonElement>();
        Assert.Equal(3, saved.GetProperty("userID").GetInt32());
        Assert.Equal("Printer checked. Awaiting part.",
            saved.GetProperty("commentText").GetString());

        var thread = await app.Send(HttpMethod.Get,
            "/api/RequestComments/request/71", userID: 3, roleID: 2);
        Assert.Equal(HttpStatusCode.OK, thread.StatusCode);
        var text = await thread.Content.ReadAsStringAsync();
        Assert.Contains("Printer checked. Awaiting part.", text);
    }

    [Fact]
    public async Task Requester_can_reply_but_unrelated_user_cannot()
    {
        using var app = new TestApp();
        Seed(app);

        var own = await app.Send(HttpMethod.Post, "/api/RequestComments",
            new { requestID = 71, commentText = "Thank you!" },
            userID: 7, roleID: 1);
        Assert.Equal(HttpStatusCode.Created, own.StatusCode);

        var unrelated = await app.Send(HttpMethod.Post, "/api/RequestComments",
            new { requestID = 71, commentText = "Private intrusion" },
            userID: 2, roleID: 1);
        Assert.Equal(HttpStatusCode.NotFound, unrelated.StatusCode);
    }

    [Fact]
    public async Task Mention_creates_only_one_persistent_portal_notification()
    {
        using var app = new TestApp();
        Seed(app);

        var posted = await app.Send(HttpMethod.Post, "/api/RequestComments",
            new {
                requestID = 71,
                commentText = "Hello @Staff Sample, your printer is ready.",
                mentionedUserIDs = new[] { 7, 7 }
            }, userID: 3, roleID: 2);
        Assert.Equal(HttpStatusCode.Created, posted.StatusCode);

        var inbox = await app.Send(HttpMethod.Get, "/api/ITNotifications", userID: 7, roleID: 1);
        Assert.Equal(HttpStatusCode.OK, inbox.StatusCode);
        var payload = await inbox.Content.ReadFromJsonAsync<System.Text.Json.JsonElement>();
        Assert.Equal(1, payload.GetProperty("unreadCount").GetInt32());
        var notices = payload.GetProperty("notifications");
        Assert.Equal(1, notices.GetArrayLength());
        var notificationId = notices[0].GetProperty("notificationID").GetInt32();

        var deniedRead = await app.Send(HttpMethod.Post,
            $"/api/ITNotifications/{notificationId}/read", userID: 2, roleID: 1);
        Assert.Equal(HttpStatusCode.NotFound, deniedRead.StatusCode);

        var read = await app.Send(HttpMethod.Post,
            $"/api/ITNotifications/{notificationId}/read", userID: 7, roleID: 1);
        Assert.Equal(HttpStatusCode.NoContent, read.StatusCode);

        var updated = await app.Send(HttpMethod.Get, "/api/ITNotifications", userID: 7, roleID: 1);
        var updatedBody = await updated.Content.ReadFromJsonAsync<System.Text.Json.JsonElement>();
        Assert.Equal(0, updatedBody.GetProperty("unreadCount").GetInt32());
    }

    [Fact]
    public async Task Forged_mention_without_visible_text_is_rejected()
    {
        using var app = new TestApp();
        Seed(app);

        var posted = await app.Send(HttpMethod.Post, "/api/RequestComments",
            new {
                requestID = 71,
                commentText = "Unrelated message",
                mentionedUserIDs = new[] { 7 }
            }, userID: 3, roleID: 2);
        Assert.Equal(HttpStatusCode.BadRequest, posted.StatusCode);
    }
}
