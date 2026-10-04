namespace NKRN.API.Models;

public sealed class AiSettings
{
    public bool Enabled { get; set; } = false;
    public string Provider { get; set; } = "Groq";
    public string BaseUrl { get; set; } = "https://api.groq.com/openai/v1";
    public string ApiKey { get; set; } = string.Empty;
    public string Model { get; set; } = "openai/gpt-oss-20b";
    public int TimeoutSeconds { get; set; } = 30;
    public int MaxDescriptionCharacters { get; set; } = 6000;
}
