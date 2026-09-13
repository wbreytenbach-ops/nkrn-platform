using MailKit.Net.Smtp;
using MailKit.Security;
using Microsoft.Extensions.Options;
using MimeKit;
using NKRN.API.Models;

namespace NKRN.API.Services
{
    public class EmailService
    {
        private readonly EmailSettings _settings;

        public EmailService(
            IOptions<EmailSettings> settings)
        {
            _settings = settings.Value;
        }

        public async Task SendEmailAsync(
            string recipientEmail,
            string subject,
            string body)
        {
            // ========================================
            // VALIDATE BASIC EMAIL SETTINGS
            // ========================================

            if (string.IsNullOrWhiteSpace(_settings.SmtpServer))
            {
                throw new InvalidOperationException(
                    "Email SMTP server has not been configured."
                );
            }

            if (_settings.SmtpPort <= 0)
            {
                throw new InvalidOperationException(
                    "Email SMTP port has not been configured."
                );
            }

            if (string.IsNullOrWhiteSpace(_settings.SenderEmail))
            {
                throw new InvalidOperationException(
                    "Email sender address has not been configured."
                );
            }

            if (string.IsNullOrWhiteSpace(_settings.Username))
            {
                throw new InvalidOperationException(
                    "Email SMTP username has not been configured."
                );
            }

            // ========================================
            // GET EMAIL PASSWORD
            //
            // First try normal ASP.NET configuration.
            // If it is not available, explicitly read
            // the machine-level environment variable.
            // ========================================

            var password = _settings.Password;

            if (string.IsNullOrWhiteSpace(password))
            {
                password =
                    Environment.GetEnvironmentVariable(
                        "Email__Password",
                        EnvironmentVariableTarget.Machine
                    );
            }

            if (string.IsNullOrWhiteSpace(password))
            {
                throw new InvalidOperationException(
                    "Email SMTP password has not been configured."
                );
            }

            // ========================================
            // BUILD EMAIL MESSAGE
            // ========================================

            var message = new MimeMessage();

            message.From.Add(
                new MailboxAddress(
                    _settings.SenderName,
                    _settings.SenderEmail
                )
            );

            message.To.Add(
                new MailboxAddress(
                    recipientEmail,
                    recipientEmail
                )
            );

            message.Subject = subject;

            message.Body = new TextPart("html")
            {
                Text = body
            };

            // ========================================
            // SEND EMAIL
            // ========================================

            using var smtp = new SmtpClient();

            await smtp.ConnectAsync(
                _settings.SmtpServer,
                _settings.SmtpPort,
                SecureSocketOptions.StartTls
            );

            await smtp.AuthenticateAsync(
                _settings.Username,
                password
            );

            await smtp.SendAsync(message);

            await smtp.DisconnectAsync(true);
        }
    }
}