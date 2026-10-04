using Microsoft.Extensions.Options;
using NKRN.API.Models;

namespace NKRN.API.Services;

public sealed class LogisticsReminderHostedService : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly IOptionsMonitor<LogisticsReminderOptions> _options;
    private readonly IWebHostEnvironment _environment;
    private readonly ILogger<LogisticsReminderHostedService> _logger;

    private DateTime? _lastAutomaticRunDate;

    public LogisticsReminderHostedService(
        IServiceScopeFactory scopeFactory,
        IOptionsMonitor<LogisticsReminderOptions> options,
        IWebHostEnvironment environment,
        ILogger<LogisticsReminderHostedService> logger)
    {
        _scopeFactory = scopeFactory;
        _options = options;
        _environment = environment;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(
        CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            var options = _options.CurrentValue;
            var now = DateTime.Now;

            var canSend =
                options.Enabled &&
                (!_environment.IsDevelopment() ||
                 options.SendInDevelopment);

            var alreadyRanToday =
                _lastAutomaticRunDate.HasValue &&
                _lastAutomaticRunDate.Value.Date ==
                    now.Date;

            if (canSend &&
                !alreadyRanToday &&
                now.Hour >= Math.Clamp(
                    options.CheckHour,
                    0,
                    23))
            {
                try
                {
                    using var scope =
                        _scopeFactory.CreateScope();

                    var service =
                        scope.ServiceProvider
                            .GetRequiredService<
                                LogisticsReminderService>();

                    var result =
                        await service.SendDueAsync(
                            now.Date,
                            stoppingToken);

                    _lastAutomaticRunDate =
                        now.Date;

                    _logger.LogInformation(
                        "Logistics reminders checked. Due={Due}; Attempted={Attempted}; Sent={Sent}; Failed={Failed}.",
                        result.DueRequests,
                        result.AttemptedDeliveries,
                        result.SentDeliveries,
                        result.FailedDeliveries);
                }
                catch (Exception ex)
                {
                    _logger.LogError(
                        ex,
                        "Automatic Logistics reminder run failed. It will retry on the next interval.");
                }
            }

            var delayMinutes =
                Math.Clamp(
                    options.CheckIntervalMinutes,
                    15,
                    1440);

            await Task.Delay(
                TimeSpan.FromMinutes(
                    delayMinutes),
                stoppingToken);
        }
    }
}
