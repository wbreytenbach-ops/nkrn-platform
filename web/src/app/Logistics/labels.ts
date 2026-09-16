const labels: Record<string, string> = {
    P1: "Critical", P2: "High", P3: "Medium", P4: "Low",
    Logged: "Aangemeld", Busy: "Besig", Done: "Afgehandel",
    "Nog nie begin": "Aangemeld", Beplan: "Aangemeld", "In Proses": "Besig", "Staan oor": "Besig",
    Event: "Funksie / Aktiwiteit", Maintenance: "Instandhouding", General: "Algemeen",
    Repair: "Herstel", Replace: "Vervang", Unsure: "Onseker", New: "Aangemeld",
    Completed: "Afgehandel", Approved: "Besig", Converted: "Besig",
    Declined: "Afgekeur", Cancelled: "Gekanselleer", "Under Review": "Besig",
    "Needs Information": "Besig", Pending: "Hangend", Open: "Oop", All: "Alles",
    Generated: "Gegenereer", Draft: "Konsep", Sending: "Besig om te stuur / bevestiging nodig",
    Sent: "Gestuur", Failed: "Misluk – hersien en probeer weer", Synced: "Gesinkroniseer",
};
export function displayLabel(value: string | null | undefined): string {
    return value ? labels[value] ?? value : "—";
}

export function requestStage(status: string): string {
    if (["Under Review", "Needs Information", "Approved", "Converted"].includes(status)) return "Busy";
    if (status === "New") return "Logged";
    if (status === "Completed") return "Done";
    return status;
}
