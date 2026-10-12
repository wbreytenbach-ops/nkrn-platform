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

        public static string AddPortalButton(string body)
        {
            const string button = """
                <div style="margin:24px 0;padding:18px 0 0;border-top:1px solid #e5e7eb;font-family:Arial,Helvetica,sans-serif;">
                  <a href="https://portal.tygies.co.za" style="display:inline-block;background:#b91c2b;color:#ffffff;text-decoration:none;font-family:Arial,sans-serif;font-weight:bold;padding:13px 20px;border-radius:7px;">Open Tygies 1 Portal / Maak Tygies 1-portaal oop</a>
                  <p style="font-size:12px;color:#6b7280;margin-top:10px;">https://portal.tygies.co.za</p>
                </div>
                """;
            var position = body.LastIndexOf("</body>", StringComparison.OrdinalIgnoreCase);
            return position < 0 ? body + button : body.Insert(position, button);
        }

        public virtual Task SendEmailAsync(string recipientEmail, string subject, string body) =>
            SendEmailToManyAsync(new[] { recipientEmail }, subject, body);

        public virtual async Task SendEmailToManyAsync(IEnumerable<string> recipientEmails, string subject, string body)
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

            foreach (var address in recipientEmails.Select(a => a.Trim()).Where(a => a.Length > 0).Distinct(StringComparer.OrdinalIgnoreCase))
                message.To.Add(MailboxAddress.Parse(address));
            if (message.To.Count == 0) throw new InvalidOperationException("At least one email recipient is required.");

            message.Subject = subject;

            message.Body = new TextPart("html")
            {
                Text = AddPortalButton(body)
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
