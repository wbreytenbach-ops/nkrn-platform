using MimeKit;
using NKRN.API.Services;
using Xunit;

namespace NKRN.Requests.Tests;

public class EmailEncodingTests
{
    [Fact]
    public void Funksieversorging_received_subject_contains_clean_en_dash()
    {
        var subject = FunksieversorgingEmailSubjects.Received(4, "Voortrekkers");

        Assert.Equal("Funksieversorging: Versoek #4 ontvang \u2013 Voortrekkers", subject);
        Assert.DoesNotContain("\u00e2", subject);
        Assert.DoesNotContain("\ufffd", subject);
    }

    [Fact]
    public void Funksieversorging_status_subject_does_not_contain_mojibake()
    {
        var subject = FunksieversorgingEmailSubjects.StatusChanged(4, "Afgehandel");

        Assert.Equal("Funksieversorging: Versoek #4 \u2013 Afgehandel", subject);
        Assert.DoesNotContain("\u00e2", subject);
    }

    [Fact]
    public void Mime_serialization_preserves_Afrikaans_subject_and_HTML_as_UTF8()
    {
        var subject = FunksieversorgingEmailSubjects.Received(4, "Voortrekkers");
        var html = "<html><body>Hierdie is \u2019n versoek. Versoek benodig klank. \u00eb</body></html>";
        var email = EmailService.CreateMimeMessage(
            "Laerskool Tygerpoort",
            "it@tygies.co.za",
            new[] { "wbreytenbach@tygies.co.za" },
            subject,
            html);

        var textPart = Assert.IsType<TextPart>(email.Body);
        Assert.Equal("utf-8", textPart.ContentType.Charset, ignoreCase: true);

        using var stream = new MemoryStream();
        email.WriteTo(stream);
        stream.Position = 0;
        var parsed = MimeMessage.Load(stream);

        Assert.Equal(subject, parsed.Subject);
        var parsedHtml = Assert.IsType<TextPart>(parsed.Body);
        Assert.Equal("utf-8", parsedHtml.ContentType.Charset, ignoreCase: true);
        Assert.Contains("Hierdie is \u2019n versoek", parsedHtml.Text);
        Assert.Contains("\u00eb", parsedHtml.Text);
        Assert.DoesNotContain("â€", parsedHtml.Text);
        Assert.Contains("Open Tygies 1 Portal", parsedHtml.Text);
    }
}
