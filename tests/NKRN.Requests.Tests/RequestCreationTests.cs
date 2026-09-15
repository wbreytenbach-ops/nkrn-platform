using System.Net;
using System.Net.Http.Json;
using System.Security.Claims;
using System.Text.Encodings.Web;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using NKRN.API.Controllers;
using NKRN.API.Data;
using NKRN.API.Models;
using NKRN.API.Services;
using Xunit;

namespace NKRN.Requests.Tests;

// Actual MVC routes, authorization filters, model binding and controller code.
// The database is in-memory; email is captured without SMTP or external calls.
public class RequestCreationTests
{
    [Fact]
    public async Task Admin_can_select_requester_and_server_retains_the_submitter()
    {
        using var app = new TestApp();
        var response = await app.Send(HttpMethod.Post, "/api/Requests", new
        {
            title = "Printer <test>", description = "Paper <script>jam</script>",
            categoryID = 1, priority = "High", requestedForUserID = 2,
            userID = 3, createdByUserID = 99, requestID = 900,
            statusID = 3, assignedTo = 3, completedDate = "2030-01-01"
        });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var request = (await response.Content.ReadFromJsonAsync<Request>())!;
        Assert.Equal(2, request.UserID);
        Assert.Equal(1, request.CreatedByUserID);
        Assert.NotEqual(900, request.RequestID);
        Assert.Equal(1, request.StatusID);
        Assert.Null(request.AssignedTo);
        Assert.Null(request.CompletedDate);
        Assert.Equal("Bea Teacher", request.UserName);
        Assert.Equal("Ada Admin", request.CreatedByName);
        Assert.Equal(2, app.Email.Messages.Count);
        Assert.Contains(app.Email.Messages, m => m.To == "teacher@example.invalid");
        Assert.Contains(app.Email.Messages, m => m.To == "admin@example.invalid");
        Assert.All(app.Email.Messages, m =>
        {
            Assert.Contains("Logged by:</strong> Ada Admin", m.Body);
            Assert.Contains("Requester:</strong> Bea Teacher", m.Body);
            Assert.Contains("&lt;script&gt;", m.Body);
            Assert.DoesNotContain("<script>", m.Body);
        });

        using var scope = app.Server.Services.CreateScope();
        var saved = await scope.ServiceProvider.GetRequiredService<ApplicationDbContext>().Requests.SingleAsync();
        Assert.Equal(2, saved.UserID);
        Assert.Equal(1, saved.CreatedByUserID);
    }

    [Theory]
    [InlineData(2, 1)] // Teacher
    [InlineData(3, 2)] // Technician
    [InlineData(2, 3)] // Stale/forged role claim must not override database role
    public async Task Nonadmins_cannot_choose_requesters_or_load_the_staff_picker(int userID, int roleID)
    {
        using var app = new TestApp();
        var created = await app.Send(HttpMethod.Post, "/api/Requests", Input(1), userID, roleID);
        Assert.Equal(HttpStatusCode.Forbidden, created.StatusCode);
        var picker = await app.Send(HttpMethod.Get, "/api/Requests/requesters", userID: userID, roleID: roleID);
        Assert.Equal(HttpStatusCode.Forbidden, picker.StatusCode);
        Assert.Empty(app.Email.Messages);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    [InlineData(4)] // Deactivated
    [InlineData(6)] // Invalid email
    [InlineData(999)] // Missing
    public async Task Invalid_requesters_are_rejected_before_a_request_is_saved(int requestedFor)
    {
        using var app = new TestApp();
        var response = await app.Send(HttpMethod.Post, "/api/Requests", Input(requestedFor));
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        using var scope = app.Server.Services.CreateScope();
        Assert.Empty(await scope.ServiceProvider.GetRequiredService<ApplicationDbContext>().Requests.ToListAsync());
        Assert.Empty(app.Email.Messages);
    }

    [Theory]
    [InlineData(1, 3)]
    [InlineData(2, 1)]
    [InlineData(3, 2)]
    public async Task Legacy_creation_defaults_to_authenticated_user(int userID, int roleID)
    {
        using var app = new TestApp();
        var response = await app.Send(HttpMethod.Post, "/api/Requests", new
        {
            title = "Own request", description = "Test", categoryID = 1,
            userID = 999, createdByUserID = 999
        }, userID, roleID);
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var request = (await response.Content.ReadFromJsonAsync<Request>())!;
        Assert.Equal(userID, request.UserID);
        Assert.Equal(userID, request.CreatedByUserID);
    }

    [Fact]
    public async Task Admin_recipient_is_not_emailed_twice_and_one_failure_does_not_block_others()
    {
        using var app = new TestApp();
        var response = await app.Send(HttpMethod.Post, "/api/Requests", Input(5));
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        Assert.Single(app.Email.Messages);
        app.Email.Messages.Clear();
        app.Email.FailFor = "admin@example.invalid";
        response = await app.Send(HttpMethod.Post, "/api/Requests", Input(2));
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        Assert.Single(app.Email.Messages);
        Assert.Equal("teacher@example.invalid", app.Email.Messages[0].To);
    }

    [Theory]
    [InlineData(2)]
    [InlineData(3)]
    public async Task History_access_and_status_email_follow_requester_and_updates_preserve_audit(int status)
    {
        using var app = new TestApp();
        var response = await app.Send(HttpMethod.Post, "/api/Requests", Input(2));
        var request = (await response.Content.ReadFromJsonAsync<Request>())!;
        var history = await app.Send(HttpMethod.Get, "/api/Requests/user/2", userID: 2, roleID: 1);
        Assert.Single((await history.Content.ReadFromJsonAsync<Request[]>())!);
        var forbidden = await app.Send(HttpMethod.Get, $"/api/Requests/{request.RequestID}", userID: 6, roleID: 1);
        Assert.Equal(HttpStatusCode.Forbidden, forbidden.StatusCode);
        app.Email.Messages.Clear();

        request.StatusID = status;
        request.UserID = 3; // Update endpoint must not change ownership.
        request.CreatedByUserID = 99;
        var update = await app.Send(HttpMethod.Put, $"/api/Requests/{request.RequestID}", request, 3, 2);
        Assert.True(update.IsSuccessStatusCode, await update.Content.ReadAsStringAsync());
        Assert.Single(app.Email.Messages);
        Assert.Equal("teacher@example.invalid", app.Email.Messages[0].To);
        using var scope = app.Server.Services.CreateScope();
        var saved = await scope.ServiceProvider.GetRequiredService<ApplicationDbContext>().Requests.SingleAsync();
        Assert.Equal(2, saved.UserID);
        Assert.Equal(1, saved.CreatedByUserID);
    }

    [Fact]
    public async Task Picker_excludes_inactive_accounts_and_history_keeps_their_names()
    {
        using var app = new TestApp();
        await app.Send(HttpMethod.Post, "/api/Requests", Input(2));
        using (var scope = app.Server.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            (await db.Users.FindAsync(2))!.IsActive = false;
            await db.SaveChangesAsync();
        }
        var picker = await app.Send(HttpMethod.Get, "/api/Requests/requesters");
        var people = (await picker.Content.ReadFromJsonAsync<User[]>())!;
        Assert.DoesNotContain(people, u => u.UserID == 2 || u.UserID == 4);
        var history = await app.Send(HttpMethod.Get, "/api/Requests");
        Assert.Equal("Bea Teacher", (await history.Content.ReadFromJsonAsync<Request[]>())!.Single().UserName);
    }

    [Fact]
    public async Task Unauthenticated_and_deactivated_submitters_cannot_create_requests()
    {
        using var app = new TestApp();
        var anonymous = await app.Send(HttpMethod.Post, "/api/Requests", Input(2), null);
        Assert.Equal(HttpStatusCode.Unauthorized, anonymous.StatusCode);
        var inactive = await app.Send(HttpMethod.Post, "/api/Requests", Input(2), 4, 3);
        Assert.Equal(HttpStatusCode.Unauthorized, inactive.StatusCode);
        Assert.Empty(app.Email.Messages);
    }

    private static object Input(int? requestedFor) => new
    {
        title = "Test request", description = "Test details", categoryID = 1,
        priority = "Medium", requestedForUserID = requestedFor
    };
}

internal sealed class TestApp : IDisposable
{
    public CapturedEmail Email { get; } = new();
    public TestServer Server { get; }
    private readonly HttpClient _client;

    public TestApp()
    {
        var databaseName = Guid.NewGuid().ToString();
        Server = new TestServer(new WebHostBuilder()
            .ConfigureServices(services =>
            {
                services.AddDbContext<ApplicationDbContext>(o => o.UseInMemoryDatabase(databaseName));
                services.AddSingleton<EmailService>(Email);
                services.AddSingleton(new GoogleCalendarService(Options.Create(new GoogleCalendarSettings())));
                services.AddAuthentication("Test").AddScheme<AuthenticationSchemeOptions, TestAuthentication>("Test", _ => { });
                services.AddAuthorization();
                services.AddControllers().AddApplicationPart(typeof(RequestsController).Assembly);
            })
            .Configure(app =>
            {
                app.UseRouting();
                app.UseAuthentication();
                app.UseAuthorization();
                app.UseEndpoints(endpoints => endpoints.MapControllers());
            }));
        _client = Server.CreateClient();
        using var scope = Server.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        db.Users.AddRange(
            new User { UserID = 1, FirstName = "Ada", LastName = "Admin", Email = "admin@example.invalid", RoleID = 3 },
            new User { UserID = 2, FirstName = "Bea", LastName = "Teacher", Email = "teacher@example.invalid", RoleID = 1 },
            new User { UserID = 3, FirstName = "Cal", LastName = "Tech", Email = "tech@example.invalid", RoleID = 2 },
            new User { UserID = 4, FirstName = "Inez", LastName = "Inactive", Email = "inactive@example.invalid", RoleID = 1, IsActive = false },
            new User { UserID = 5, FirstName = "Devon", LastName = "Admin", Email = " ADMIN@example.invalid ", RoleID = 3 },
            new User { UserID = 6, FirstName = "Eden", LastName = "Email", Email = "invalid", RoleID = 1 });
        db.Categories.Add(new Category { CategoryID = 1, CategoryName = "General" });
        db.SaveChanges();
    }

    public Task<HttpResponseMessage> Send(HttpMethod method, string path, object? body = null, int? userID = 1, int roleID = 3)
    {
        var request = new HttpRequestMessage(method, path);
        if (userID.HasValue) request.Headers.Add("X-Test-Actor", $"{userID}:{roleID}");
        if (body != null) request.Content = JsonContent.Create(body);
        return _client.SendAsync(request);
    }

    public void Dispose() { _client.Dispose(); Server.Dispose(); }
}

internal sealed class CapturedEmail : EmailService
{
    public List<(string To, string Subject, string Body)> Messages { get; } = [];
    public string? FailFor { get; set; }
    public CapturedEmail() : base(Options.Create(new EmailSettings())) { }
    public override Task SendEmailAsync(string recipientEmail, string subject, string body)
    {
        if (recipientEmail == FailFor) throw new InvalidOperationException("Simulated delivery failure");
        Messages.Add((recipientEmail, subject, body));
        return Task.CompletedTask;
    }
}

internal sealed class TestAuthentication : AuthenticationHandler<AuthenticationSchemeOptions>
{
    public TestAuthentication(IOptionsMonitor<AuthenticationSchemeOptions> options, ILoggerFactory logger, UrlEncoder encoder)
        : base(options, logger, encoder) { }
    protected override Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        var actor = Request.Headers["X-Test-Actor"].ToString().Split(':');
        if (actor.Length != 2) return Task.FromResult(AuthenticateResult.NoResult());
        var identity = new ClaimsIdentity(new[]
        {
            new Claim(ClaimTypes.NameIdentifier, actor[0]), new Claim(ClaimTypes.Role, actor[1])
        }, Scheme.Name);
        return Task.FromResult(AuthenticateResult.Success(new AuthenticationTicket(new ClaimsPrincipal(identity), Scheme.Name)));
    }
}
