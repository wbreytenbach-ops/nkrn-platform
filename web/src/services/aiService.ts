const API_URL = process.env.NEXT_PUBLIC_API_URL;

export interface AiConversationMessage {
    role: "user" | "assistant";
    content: string;
}

export interface AiTriageResult {
    sessionID: string | null;
    success: boolean;
    provider: string;
    model: string;
    moduleKey: string;
    suggestedTitle: string;
    summary: string;
    suggestedCategory: string | null;
    suggestedRequestType: "Event" | "Maintenance" | "General" | null;
    suggestedPriority: "Low" | "Medium" | "High" | "Critical";
    needsHuman: boolean;
    confidence: number;
    userMessage: string;
    troubleshootingSteps: string[];
    routingReason: string;
    ruleTriggered: boolean;
    ruleReason: string | null;
}

function getHeaders(): HeadersInit {
    const token =
        typeof window === "undefined"
            ? null
            : localStorage.getItem("token");

    return {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
}

export async function startAiHelp(input: {
    moduleKey: "IT" | "Logistics" | "Funksieversorging";
    description: string;
    additionalContext?: string;
    conversation?: AiConversationMessage[];
}): Promise<AiTriageResult> {
    const response = await fetch(`${API_URL}/api/AI/help`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({
            moduleKey: input.moduleKey,
            description: input.description,
            additionalContext: input.additionalContext ?? null,
            conversation: input.conversation ?? [],
        }),
    });

    if (!response.ok) {
        throw new Error(`AI help failed with status ${response.status}.`);
    }

    return response.json();
}

export async function completeAiHelp(input: {
    sessionID: string;
    outcome: "ResolvedByAI" | "RequestLogged" | "HumanRequired" | "Abandoned";
    requestID?: number;
    userResponse?: string;
}): Promise<void> {
    const response = await fetch(`${API_URL}/api/AI/help/outcome`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify(input),
    });

    if (!response.ok) {
        throw new Error(`AI outcome failed with status ${response.status}.`);
    }
}

// Backward compatible wrapper for the IT page.
export async function getItAiHelp(
    description: string,
    conversation: AiConversationMessage[] = []
): Promise<AiTriageResult> {
    return startAiHelp({
        moduleKey: "IT",
        description,
        conversation,
    });
}
