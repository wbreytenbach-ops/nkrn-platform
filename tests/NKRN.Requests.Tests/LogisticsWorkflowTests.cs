using System.Net;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Logging.Abstractions;
using NKRN.API.Data;
using NKRN.API.Models;
using NKRN.API.Services;
using Xunit;

namespace NKRN.Requests.Tests;

public class LogisticsWorkflowTests
{
    [Theory]
    [InlineData(2,1)]
    [InlineData(2,3)]
    [InlineData(3,2)]
    [InlineData(4,3)]
    public async Task Deletion_requires_an_active_database_admin(
        int userID,
        int roleID)
    {
        using var app=new TestApp();

        var response=await app.Send(
            HttpMethod.Delete,
            "/api/LogisticsRequests/12",
            userID:userID,
            roleID:roleID);

        Assert.Equal(
            HttpStatusCode.Forbidden,
            response.StatusCode);
    }

    [Fact]
    public async Task Notifications_include_requester_and_both_logistics_managers_once_and_encode_content()
    {
        using var app=new TestApp();
        using var scope=app.Server.Services.CreateScope();

        var db=scope.ServiceProvider
            .GetRequiredService<ApplicationDbContext>();

        var service=Service(db,app.Email);

        await service.NotifyAsync(
            new LogisticsRequestResponse
            {
                RequestID=1,
                Title="<script>test</script>",
                RequestedByEmail="teacher@example.invalid",
                RequestedByName="Teacher",
                Status="Logged",
                Priority="Critical"
            },
            true);

        Assert.Equal(4,app.Email.Messages.Count);
        Assert.Contains(app.Email.Messages,m=>m.To=="teacher@example.invalid");
        Assert.Contains(app.Email.Messages,m=>m.To=="logistiek@tygies.co.za");
        Assert.Contains(app.Email.Messages,m=>m.To=="terreinbestuur@tygies.co.za");
        Assert.Contains(app.Email.Messages,m=>m.To=="msmit@tygies.co.za");
        Assert.DoesNotContain(app.Email.Messages,m=>m.To=="mcarnie@tygies.co.za");
        Assert.DoesNotContain(app.Email.Messages,m=>m.To=="admin@example.invalid");

        Assert.All(
            app.Email.Messages,
            m=>
            {
                Assert.Contains("&lt;script&gt;",m.Body);
                Assert.DoesNotContain("<script>",m.Body);
                Assert.Contains("Kritiek",m.Body);
                Assert.Contains("Aangemeld",m.Body);
            });
    }

    [Fact]
    public async Task Failure_for_one_logistics_manager_does_not_prevent_other_notifications()
    {
        using var app=new TestApp();
        using var scope=app.Server.Services.CreateScope();

        app.Email.FailFor="terreinbestuur@tygies.co.za";

        await Service(
            scope.ServiceProvider.GetRequiredService<ApplicationDbContext>(),
            app.Email)
            .NotifyAsync(
                new LogisticsRequestResponse
                {
                    RequestID=1,
                    RequestedByEmail="teacher@example.invalid",
                    Status="Done",
                    Priority="Medium"
                });

        Assert.Equal(3,app.Email.Messages.Count);
        Assert.Contains(app.Email.Messages,m=>m.To=="teacher@example.invalid");
        Assert.Contains(app.Email.Messages,m=>m.To=="logistiek@tygies.co.za");
        Assert.Contains(app.Email.Messages,m=>m.To=="msmit@tygies.co.za");
        Assert.DoesNotContain(app.Email.Messages,m=>m.To=="mcarnie@tygies.co.za");
    }

    [Fact]
    public async Task Requester_who_is_also_a_logistics_recipient_gets_one_message()
    {
        using var app=new TestApp();
        using var scope=app.Server.Services.CreateScope();

        await Service(
            scope.ServiceProvider.GetRequiredService<ApplicationDbContext>(),
            app.Email)
            .NotifyAsync(
                new LogisticsRequestResponse
                {
                    RequestID=1,
                    RequestedByEmail=" TERREINBESTUUR@tygies.co.za ",
                    Status="Logged"
                });

        Assert.Equal(3,app.Email.Messages.Count);
        Assert.Contains(app.Email.Messages,m=>m.To=="logistiek@tygies.co.za");
        Assert.Contains(app.Email.Messages,m=>m.To=="msmit@tygies.co.za");
        Assert.DoesNotContain(app.Email.Messages,m=>m.To=="mcarnie@tygies.co.za");
    }

    [Fact]
    public async Task Security_request_notification_includes_security_contact()
    {
        using var app=new TestApp();
        using var scope=app.Server.Services.CreateScope();

        await Service(
            scope.ServiceProvider.GetRequiredService<ApplicationDbContext>(),
            app.Email)
            .NotifyAsync(
                new LogisticsRequestResponse
                {
                    RequestID=2,
                    RequestType="Security",
                    RequestedByEmail="teacher@example.invalid",
                    Status="Logged",
                    Priority="High"
                },
                true);

        Assert.Contains(app.Email.Messages,m=>m.To=="jwerner@tygies.co.za");
        Assert.DoesNotContain(app.Email.Messages,m=>m.To=="mcarnie@tygies.co.za");
    }

    [Fact]
    public async Task Development_does_not_send_real_notifications_by_default()
    {
        using var app=new TestApp();
        using var scope=app.Server.Services.CreateScope();

        await Service(
            scope.ServiceProvider.GetRequiredService<ApplicationDbContext>(),
            app.Email,
            "Development")
            .NotifyAsync(
                new LogisticsRequestResponse
                {
                    RequestID=1,
                    RequestedByEmail="teacher@example.invalid"
                });

        Assert.Empty(app.Email.Messages);
    }

    [Theory]
    [InlineData("<html><body>Message</body></html>")]
    [InlineData("<HTML><BODY>Message</BODY></HTML>")]
    [InlineData("Message")]
    public void Every_email_has_a_portal_button_without_auth_tokens(
        string html)
    {
        var result=EmailService.AddPortalButton(html);

        Assert.Contains(
            "href=\"https://portal.tygies.co.za\"",
            result);

        Assert.Contains(
            "Open NKRN Portal / Maak NKRN-portaal oop",
            result);

        Assert.DoesNotContain(
            "token=",
            result);

        if(html.Contains(
            "</body>",
            StringComparison.OrdinalIgnoreCase))
        {
            Assert.True(
                result.IndexOf(
                    "href=",
                    StringComparison.Ordinal)
                <
                result.LastIndexOf(
                    "</body>",
                    StringComparison.OrdinalIgnoreCase));
        }
    }

    [Fact]
    public void Master_card_defaults_to_both_authorized_recipients()
    {
        Assert.Equal(
            new[]
            {
                "terreinbestuur@tygies.co.za",
                "logistiek@tygies.co.za"
            },
            new LogisticsAutomationOptions()
                .MasterRecipientEmails);
    }

    [Theory]
    [InlineData("Die pyp buite K1 het gebars en water loop oral.")]
    [InlineData("Daar is 'n groot water lek by die kleedkamers.")]
    [InlineData("Die riool loop oor by die badkamers.")]
    public void Active_water_or_sewer_incidents_are_forced_to_critical(
        string description)
    {
        var result=
            NkrnRequestRules.Evaluate(
                "Logistics",
                description);

        Assert.True(result.Triggered);
        Assert.Equal("Critical",result.Priority);
        Assert.Equal("Maintenance",result.SuggestedRequestType);
        Assert.True(result.NeedsHuman);
    }

    [Fact]
    public void A_broken_chair_is_not_automatically_critical()
    {
        var result=
            NkrnRequestRules.Evaluate(
                "Logistics",
                "Die stoel in K1 se poot het gebreek.");

        Assert.False(result.Triggered);
        Assert.Equal("Medium",result.Priority);
    }

    [Fact]
    public void Deterministic_critical_priority_cannot_be_downgraded_by_ai()
    {
        Assert.Equal(
            "Critical",
            NkrnRequestRules.MergePriority(
                "Critical",
                "Low"));

        Assert.Equal(
            "Critical",
            NkrnRequestRules.MergePriority(
                "Medium",
                "Critical"));
    }

    [Theory]
    [InlineData("P1","Critical")]
    [InlineData("P2","High")]
    [InlineData("P3","Medium")]
    [InlineData("P4","Low")]
    [InlineData("Critical","Critical")]
    [InlineData("High","High")]
    [InlineData("Medium","Medium")]
    [InlineData("Low","Low")]
    public void Legacy_and_new_priorities_normalise_to_the_same_request_priority(
        string input,
        string expected)
    {
        Assert.Equal(
            expected,
            NkrnRequestRules.NormalisePriority(
                input));
    }

    [Theory]
    [InlineData("New","Logged")]
    [InlineData("Logged","Logged")]
    [InlineData("Under Review","Busy")]
    [InlineData("Converted","Busy")]
    [InlineData("Busy","Busy")]
    [InlineData("Completed","Done")]
    [InlineData("Done","Done")]
    public void Legacy_and_new_statuses_normalise_to_the_same_request_stage(
        string input,
        string expected)
    {
        Assert.Equal(
            expected,
            NkrnRequestRules.NormaliseRequestStatus(
                input));
    }

    [Theory]
    [InlineData(7,"7D")]
    [InlineData(1,"1D")]
    [InlineData(6,null)]
    [InlineData(3,null)]
    [InlineData(0,null)]
    [InlineData(-1,null)]
    public void Function_reminders_are_only_due_at_7_days_and_1_day(
        int daysUntil,
        string? expected)
    {
        var today=
            new DateTime(
                2026,
                9,
                16);

        Assert.Equal(
            expected,
            LogisticsReminderService.ReminderTypeFor(
                today,
                today.AddDays(daysUntil)));
    }

    [Fact]
    public void Reminder_defaults_include_both_logistics_managers()
    {
        var options=
            new LogisticsReminderOptions();

        Assert.Contains(
            "terreinbestuur@tygies.co.za",
            options.RecipientEmails,
            StringComparer.OrdinalIgnoreCase);

        Assert.Contains(
            "logistiek@tygies.co.za",
            options.RecipientEmails,
            StringComparer.OrdinalIgnoreCase);

        Assert.Contains(
            "msmit@tygies.co.za",
            options.RecipientEmails,
            StringComparer.OrdinalIgnoreCase);

        Assert.DoesNotContain(
            "mcarnie@tygies.co.za",
            options.RecipientEmails,
            StringComparer.OrdinalIgnoreCase);
    }

    private static LogisticsRequestNotificationService Service(
        ApplicationDbContext db,
        EmailService email,
        string environment="Production") =>
        new(
            db,
            email,
            new ConfigurationBuilder().Build(),
            new EnvironmentStub
            {
                EnvironmentName=environment
            },
            NullLogger<LogisticsRequestNotificationService>.Instance);

    private sealed class EnvironmentStub:IWebHostEnvironment
    {
        public string EnvironmentName {get;set;}="Production";
        public string ApplicationName {get;set;}="Tests";
        public string ContentRootPath {get;set;}="";
        public string WebRootPath {get;set;}="";
        public IFileProvider ContentRootFileProvider {get;set;}=
            new NullFileProvider();
        public IFileProvider WebRootFileProvider {get;set;}=
            new NullFileProvider();
    }
}
