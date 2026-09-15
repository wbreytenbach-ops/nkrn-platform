const labels: Record<string, string> = {
    Event: "Funksie / Aktiwiteit", Maintenance: "Instandhouding", General: "Algemeen",
    Repair: "Herstel", Replace: "Vervang", Unsure: "Onseker", New: "Nuut",
    Completed: "Afgehandel", Approved: "Goedgekeur", Converted: "Na taak omgeskakel",
    Declined: "Afgekeur", Cancelled: "Gekanselleer", "Under Review": "Onder hersiening",
    "Needs Information": "Meer inligting benodig", Pending: "Hangend", Open: "Oop", All: "Alles",
    Generated: "Gegenereer", Draft: "Konsep", Sending: "Besig om te stuur / bevestiging nodig",
    Sent: "Gestuur", Failed: "Misluk – hersien en probeer weer", Synced: "Gesinkroniseer",
};
export function displayLabel(value: string | null | undefined): string {
    return value ? labels[value] ?? value : "—";
}
