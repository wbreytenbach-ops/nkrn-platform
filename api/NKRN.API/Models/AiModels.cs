namespace NKRN.API.Models;

public sealed class AiConversationMessage
{
    public string Role { get; set; } = "user";
    public string Content { get; set; } = string.Empty;
}

public sealed class AiTriageRequest
{
    public string ModuleKey { get; set; } = "IT";
    public string Description { get; set; } = string.Empty;
    public string? AdditionalContext { get; set; }
    public List<string> AllowedCategories { get; set; } = new();
    public List<AiConversationMessage> Conversation { get; set; } = new();
}

public sealed class AiTriageResult
{
    public Guid? SessionID { get; set; }
    public bool Success { get; set; }
    public string Provider { get; set; } = "Fallback";
    public string Model { get; set; } = string.Empty;
    public string ModuleKey { get; set; } = string.Empty;
    public string SuggestedTitle { get; set; } = string.Empty;
    public string Summary { get; set; } = string.Empty;
    public string? SuggestedCategory { get; set; }
    public string? SuggestedRequestType { get; set; }
    public string SuggestedPriority { get; set; } = "Medium";
    public bool NeedsHuman { get; set; } = true;
    public double Confidence { get; set; }
    public string UserMessage { get; set; } = string.Empty;
    public List<string> TroubleshootingSteps { get; set; } = new();
    public string RoutingReason { get; set; } = string.Empty;
    public bool RuleTriggered { get; set; }
    public string? RuleReason { get; set; }
}

public sealed class AiHelpInput
{
    public string ModuleKey { get; set; } = "IT";
    public string Description { get; set; } = string.Empty;
    public string? AdditionalContext { get; set; }
    public List<AiConversationMessage> Conversation { get; set; } = new();
}

public sealed class AiHelpOutcomeInput
{
    public Guid SessionID { get; set; }
    public string Outcome { get; set; } = string.Empty;
    public int? RequestID { get; set; }
    public string? UserResponse { get; set; }
}
