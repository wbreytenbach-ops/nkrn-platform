namespace NKRN.API.Services;

/// <summary>
/// Centralised UTF-8-safe subject templates for Funksieversorging.
/// Use Unicode escapes for typographic separators so source-editor encoding
/// changes cannot introduce mojibake into outgoing emails.
/// </summary>
public static class FunksieversorgingEmailSubjects
{
    public static string Received(int requestID, string functionName) =>
        $"Funksieversorging: Versoek #{requestID} ontvang \u2013 {functionName}";

    public static string StatusChanged(int requestID, string statusLabel) =>
        $"Funksieversorging: Versoek #{requestID} \u2013 {statusLabel}";
}
