using System.Text;
using NKRN.API.Data;
using NKRN.API.Models;
using NKRN.API.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi;

var builder = WebApplication.CreateBuilder(args);

// ============================================================
// DATABASE
// ============================================================

builder.Services.AddDbContext<ApplicationDbContext>(options =>
    options.UseSqlServer(
        builder.Configuration.GetConnectionString("DefaultConnection"), sql => sql.UseCompatibilityLevel(130)
    )
);

// ============================================================
// CORS
// ============================================================

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowNextApp", policy =>
    {
        policy
            .WithOrigins(
                "http://localhost:3000",
                "https://portal.tygies.co.za",
                "http://TYGIES-APP:3000",
                "http://tygies-app:3000",
                "http://192.168.3.6:3000"
            )
            .AllowAnyHeader()
            .AllowAnyMethod();
    });
});

// ============================================================
// JWT
// ============================================================

var jwtKey = builder.Configuration["Jwt:Key"];

if (string.IsNullOrWhiteSpace(jwtKey))
{
    throw new InvalidOperationException(
        "JWT key has not been configured."
    );
}

var jwtIssuer = builder.Configuration["Jwt:Issuer"];

if (string.IsNullOrWhiteSpace(jwtIssuer))
{
    throw new InvalidOperationException(
        "JWT issuer has not been configured."
    );
}

var jwtAudience = builder.Configuration["Jwt:Audience"];

if (string.IsNullOrWhiteSpace(jwtAudience))
{
    throw new InvalidOperationException(
        "JWT audience has not been configured."
    );
}

builder.Services
    .AddAuthentication(
        JwtBearerDefaults.AuthenticationScheme
    )
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters =
            new TokenValidationParameters
            {
                ValidateIssuerSigningKey = true,

                IssuerSigningKey =
                    new SymmetricSecurityKey(
                        Encoding.UTF8.GetBytes(jwtKey)
                    ),

                ValidateIssuer = true,
                ValidIssuer = jwtIssuer,

                ValidateAudience = true,
                ValidAudience = jwtAudience,

                ValidateLifetime = true,

                ClockSkew = TimeSpan.Zero
            };
    });

builder.Services.AddAuthorization();

// ============================================================
// EMAIL
// ============================================================

builder.Services.Configure<EmailSettings>(
    builder.Configuration.GetSection("Email")
);

builder.Services.AddScoped<EmailService>();

builder.Services.Configure<AiSettings>(
    builder.Configuration.GetSection("AI")
);
builder.Services.AddHttpClient("NKRN-AI")
    .ConfigurePrimaryHttpMessageHandler(() => new HttpClientHandler
    {
        SslProtocols = System.Security.Authentication.SslProtocols.Tls12
    });
builder.Services.AddScoped<NkrnAiService>();

builder.Services.AddScoped<LogisticsRequestNotificationService>();
builder.Services.Configure<LogisticsAutomationOptions>(builder.Configuration.GetSection("LogisticsAutomation"));
builder.Services.AddScoped<LogisticsJobCardService>();
builder.Services.AddScoped<LogisticsCalendarSyncService>();
builder.Services.AddHostedService<LogisticsAutomationService>();

builder.Services.Configure<LogisticsReminderOptions>(
    builder.Configuration.GetSection("LogisticsReminders")
);
builder.Services.AddScoped<LogisticsReminderService>();
builder.Services.AddHostedService<LogisticsReminderHostedService>();

// ============================================================
// GOOGLE CALENDAR
// ============================================================

builder.Services.Configure<GoogleCalendarSettings>(
    builder.Configuration.GetSection("GoogleCalendar")
);

builder.Services.AddScoped<GoogleCalendarService>();

// ============================================================
// CONTROLLERS
// ============================================================

builder.Services.AddControllers();

builder.Services.AddEndpointsApiExplorer();

// ============================================================
// SWAGGER
// ============================================================

builder.Services.AddSwaggerGen(options =>
{
    options.AddSecurityDefinition(
        "Bearer",
        new OpenApiSecurityScheme
        {
            Type = SecuritySchemeType.Http,
            Scheme = "bearer",
            BearerFormat = "JWT",
            Name = "Authorization",
            In = ParameterLocation.Header,
            Description = "Enter your JWT token here."
        }
    );

    options.AddSecurityRequirement(document =>
        new OpenApiSecurityRequirement
        {
            [
                new OpenApiSecuritySchemeReference(
                    "Bearer",
                    document
                )
            ] = new List<string>()
        }
    );
});

// ============================================================
// BUILD APPLICATION
// ============================================================

var app = builder.Build();

// ============================================================
// SWAGGER
// ============================================================

app.UseSwagger();
app.UseSwaggerUI();

// ============================================================
// CORS
// ============================================================

app.UseCors("AllowNextApp");

// ============================================================
// HTTPS
// ============================================================

app.UseHttpsRedirection();

// ============================================================
// AUTHENTICATION / AUTHORIZATION
// ============================================================

app.UseAuthentication();
app.UseAuthorization();

// ============================================================
// CONTROLLERS
// ============================================================

app.MapControllers();

// ============================================================
// RUN
// ============================================================

app.Run();