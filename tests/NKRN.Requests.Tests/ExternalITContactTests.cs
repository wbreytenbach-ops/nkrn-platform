using System.Net;
using System.Net.Http.Json;
using Microsoft.Extensions.DependencyInjection;
using NKRN.API.Data;
using NKRN.API.Models;
using Xunit;

namespace NKRN.Requests.Tests;

public class ExternalITContactTests
{
    [Fact]
    public async Task Admin_can_add_external_Jaron_contact_to_IT_assignment_list()
    {
        using var app = new TestApp();

        var created = await app.Send(HttpMethod.Post, "/api/Auth/register",
            new {
                firstName = "Jaron",
                lastName = "IT",
                email = "dispatch@jaronit.example",
                roleID = 1,
                externalITContact = true
            }, userID: 1, roleID: 3);

        Assert.Equal(HttpStatusCode.Created, created.StatusCode);

        var techList = await app.Send(HttpMethod.Get, "/api/Users/technicians",
            userID: 3, roleID: 2);
        Assert.Equal(HttpStatusCode.OK, techList.StatusCode);
        var json = await techList.Content.ReadAsStringAsync();
        Assert.Contains("dispatch@jaronit.example", json);

        // Contact is not a portal user; existing school-only login remains unchanged.
        var login = await app.Send(HttpMethod.Post, "/api/Auth/login",
            new { email = "dispatch@jaronit.example" }, userID: null);
        Assert.Equal(HttpStatusCode.Unauthorized, login.StatusCode);
    }

    [Fact]
    public async Task External_contacts_cannot_get_technician_or_admin_role()
    {
        using var app = new TestApp();
        var response = await app.Send(HttpMethod.Post, "/api/Auth/register",
            new {
                firstName = "Outside",
                lastName = "Admin",
                email = "someone@vendor.example",
                roleID = 3,
                externalITContact = true
            }, userID: 1, roleID: 3);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }
}
