const labels: Record<string, string> = {
    P1: "Critical",
    P2: "High",
    P3: "Medium",
    P4: "Low",

    Logged: "Logged",
    Busy: "Busy",
    Done: "Done",

    "Nog nie begin": "Logged",
    Beplan: "Logged",
    "In Proses": "Busy",
    "Staan oor": "Busy",

    Event: "Event",
    Maintenance: "Maintenance",
    General: "General",

    Repair: "Repair",
    Replace: "Replace",
    Unsure: "Unsure",

    New: "Logged",
    Completed: "Done",
    Approved: "Busy",
    Converted: "Busy",
    Declined: "Declined",
    Cancelled: "Cancelled",
    "Under Review": "Busy",
    "Needs Information": "Busy",

    Pending: "Pending",
    Open: "Open",
    All: "All",

    Generated: "Generated",
    Draft: "Draft",
    Sending: "Sending / confirmation required",
    Sent: "Sent",
    Failed: "Failed - review and try again",
    Synced: "Synced",
};

export function displayLabel(value: string | null | undefined): string {
    return value ? labels[value] ?? value : "\u2014";
}

export function requestStage(status: string): string {
    if (
        ["Under Review", "Needs Information", "Approved", "Converted"].includes(
            status
        )
    ) {
        return "Busy";
    }

    if (status === "New") return "Logged";
    if (status === "Completed") return "Done";

    return status;
}