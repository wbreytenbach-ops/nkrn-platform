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
    [InlineData(2,3)] // stale or forged admin claim
    [InlineData(3,2)]
    [InlineData(4,3)] // inactive account
    public async Task Deletion_requires_an_active_database_admin(int userID,int roleID)
    {
        using var app=new TestApp();
        var response=await app.Send(HttpMethod.Delete,"/api/LogisticsRequests/12",userID:userID,roleID:roleID);
        Assert.Equal(HttpStatusCode.Forbidden,response.StatusCode);
    }

    [Fact]
    public async Task Notifications_include_requester_admins_and_manager_once_and_encode_content()
    {
        using var app=new TestApp();
        using var scope=app.Server.Services.CreateScope();
        var db=scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var service=Service(db,app.Email);
        await service.NotifyAsync(new LogisticsRequestResponse { RequestID=1, Title="<script>test</script>", RequestedByEmail="teacher@example.invalid", RequestedByName="Teacher", Status="New" },true);
        Assert.Equal(3,app.Email.Messages.Count);
        Assert.Contains(app.Email.Messages,m=>m.To=="teacher@example.invalid");
        Assert.Contains(app.Email.Messages,m=>m.To=="admin@example.invalid");
        Assert.Contains(app.Email.Messages,m=>m.To=="mcarnie@tygies.co.za");
        Assert.All(app.Email.Messages,m=>{Assert.Contains("&lt;script&gt;",m.Body); Assert.DoesNotContain("<script>",m.Body);});
    }

    [Fact]
    public async Task Failure_for_one_recipient_does_not_prevent_other_notifications()
    {
        using var app=new TestApp();
        using var scope=app.Server.Services.CreateScope();
        app.Email.FailFor="admin@example.invalid";
        await Service(scope.ServiceProvider.GetRequiredService<ApplicationDbContext>(),app.Email).NotifyAsync(new LogisticsRequestResponse {RequestID=1,RequestedByEmail="teacher@example.invalid",Status="Completed"});
        Assert.Equal(2,app.Email.Messages.Count);
        Assert.Contains(app.Email.Messages,m=>m.To=="teacher@example.invalid");
        Assert.Contains(app.Email.Messages,m=>m.To=="mcarnie@tygies.co.za");
    }

    [Fact]
    public async Task Requester_who_is_also_admin_gets_one_message()
    {
        using var app=new TestApp();
        using var scope=app.Server.Services.CreateScope();
        await Service(scope.ServiceProvider.GetRequiredService<ApplicationDbContext>(),app.Email).NotifyAsync(new LogisticsRequestResponse {RequestID=1,RequestedByEmail=" ADMIN@example.invalid "});
        Assert.Equal(2,app.Email.Messages.Count);
    }

    [Fact]
    public async Task Development_does_not_send_real_notifications_by_default()
    {
        using var app=new TestApp();
        using var scope=app.Server.Services.CreateScope();
        await Service(scope.ServiceProvider.GetRequiredService<ApplicationDbContext>(),app.Email,"Development").NotifyAsync(new LogisticsRequestResponse {RequestID=1,RequestedByEmail="teacher@example.invalid"});
        Assert.Empty(app.Email.Messages);
    }

    [Theory]
    [InlineData("<html><body>Message</body></html>")]
    [InlineData("<HTML><BODY>Message</BODY></HTML>")]
    [InlineData("Message")]
    public void Every_email_has_a_portal_button_without_auth_tokens(string html)
    {
        var result=EmailService.AddPortalButton(html);
        Assert.Contains("href=\"https://portal.tygies.co.za\"",result);
        Assert.Contains("Open NKRN Portal / Maak NKRN-portaal oop",result);
        Assert.DoesNotContain("token=",result);
        if(html.Contains("</body>",StringComparison.OrdinalIgnoreCase))
            Assert.True(result.IndexOf("href=",StringComparison.Ordinal)<result.LastIndexOf("</body>",StringComparison.OrdinalIgnoreCase));
    }

    [Fact]
    public void Master_card_defaults_to_both_authorized_recipients()
    {
        Assert.Equal(new[]{"terreinbestuur@tygies.co.za","mcarnie@tygies.co.za"},new LogisticsAutomationOptions().MasterRecipientEmails);
    }

    private static LogisticsRequestNotificationService Service(ApplicationDbContext db,EmailService email,string environment="Production") =>
        new(db,email,new ConfigurationBuilder().Build(),new EnvironmentStub {EnvironmentName=environment},NullLogger<LogisticsRequestNotificationService>.Instance);
    private sealed class EnvironmentStub:IWebHostEnvironment
    {
        public string EnvironmentName {get;set;}="Production";
        public string ApplicationName {get;set;}="Tests";
        public string ContentRootPath {get;set;}="";
        public string WebRootPath {get;set;}="";
        public IFileProvider ContentRootFileProvider {get;set;}=new NullFileProvider();
        public IFileProvider WebRootFileProvider {get;set;}=new NullFileProvider();
    }
}
