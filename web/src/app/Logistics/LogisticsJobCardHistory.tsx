"use client";
import { useState } from "react";
import { displayLabel } from "./labels";
import "./worker-print.css";

interface CardItem { jobCardItemID: number; workerID: number | null; workerName: string | null; taskDescription: string; area: string | null; priority: string; materialsRequired: string | null; managerNote: string | null; status: string; plannedStart?: string | null; plannedEnd?: string | null; }
export interface HistoryCard { jobCardID: number; jobCardNumber: string; jobCardDate: string; generatedAt: string; generatedByUserID: number | null; recipientEmail: string | null; itemCount: number; workerCount?: number; status: string; sentAt: string | null; deliveryNote?: string | null; }
interface DetailCard extends HistoryCard { items: CardItem[]; }
const api = process.env.NEXT_PUBLIC_API_URL;
export default function LogisticsJobCardHistory({ cards, refresh }: { cards: HistoryCard[]; refresh: () => void }) {
    const [detail, setDetail] = useState<DetailCard | null>(null);
    const [worker, setWorker] = useState("all");
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);
    async function view(id: number) {
        setBusy(true); setError("");
        try { const response = await fetch(`${api}/api/LogisticsJobCards/${id}`, { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } }); if (!response.ok) throw new Error("Werkkaart kon nie gelaai word nie."); setDetail(await response.json()); setWorker("all"); }
        catch (e) { setError(e instanceof Error ? e.message : "Werkkaart kon nie gelaai word nie."); } finally { setBusy(false); }
    }
    async function send(card: HistoryCard) {
        if (card.status === "Failed" && !window.confirm("Aflewering is onseker. Het u die ontvanger se pos nagegaan en bevestig dat hierdie kaart nie afgelewer is nie?")) return;
        setBusy(true); setError("");
        try { const response = await fetch(`${api}/api/LogisticsJobCards/${card.jobCardID}/send`, { method: "POST", headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } }); if (!response.ok) { const result = await response.json(); throw new Error(result.message || "Stuur het misluk."); } refresh(); }
        catch (e) { setError(e instanceof Error ? e.message : "Stuur het misluk."); } finally { setBusy(false); }
    }
    async function review(card: HistoryCard, delivered: boolean) {
        if (!window.confirm(delivered ? "Bevestig dat die ontvanger hierdie kaart ontvang het?" : "Het u bevestig dat hierdie kaart NIE afgelewer is nie? ’n Handmatige herstuur word dan toegelaat.")) return;
        setBusy(true); setError("");
        try { const response = await fetch(`${api}/api/LogisticsJobCards/${card.jobCardID}/delivery-review`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("token")}` }, body: JSON.stringify({ confirmedDelivered: delivered, confirmedNotDelivered: !delivered }) }); if (!response.ok) throw new Error("Hersiening kon nie gestoor word nie. Die kaart is moontlik nog besig om te stuur."); refresh(); }
        catch (e) { setError(e instanceof Error ? e.message : "Hersiening het misluk."); } finally { setBusy(false); }
    }
    const groups = detail ? Array.from(new Set(detail.items.map(item => String(item.workerID ?? "none")))) : [];
    const date = (value: string) => new Date(value).toLocaleDateString("af-ZA");
    return <section id="werkkaarte" className="nkrn-panel mb-8 p-6">
        <div className="no-worker-print"><h2 className="text-2xl font-semibold">Werkkaartgeskiedenis</h2><p className="mt-2 text-sm text-zinc-300">Meesterwerkkaarte en drukbare kaarte per werker. Elke kaart behou die werkplan soos dit gegenereer is.</p>
        {error && <p role="alert" className="mt-3 text-red-300">{error}</p>}
        <div className="mt-5 overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr>{["Datum / Kaart", "Gegenereer / Deur", "Ontvanger", "Werk / Werkers", "E-pos", "Aksies"].map(label => <th className="p-3" key={label}>{label}</th>)}</tr></thead><tbody>{cards.map(card => <tr key={card.jobCardID} className="border-t border-white/10"><td className="p-3">{date(card.jobCardDate)}<br />{card.jobCardNumber}</td><td className="p-3">{new Date(card.generatedAt + (/[Z+]/.test(card.generatedAt) ? "" : "Z")).toLocaleString("af-ZA", { timeZone: "Africa/Johannesburg" })}<br />{card.generatedByUserID ? `Gebruiker #${card.generatedByUserID}` : "Outomaties"}</td><td className="p-3">{card.recipientEmail}</td><td className="p-3">{card.itemCount} / {card.workerCount ?? "—"}</td><td className="p-3">{displayLabel(card.status)}{card.sentAt && <p>{new Date(card.sentAt + (/[Z+]/.test(card.sentAt) ? "" : "Z")).toLocaleString("af-ZA", { timeZone: "Africa/Johannesburg" })}</p>}<p>{card.deliveryNote}</p></td><td className="p-3"><button className="q4-nav" disabled={busy} onClick={() => void view(card.jobCardID)}>Bekyk / Druk</button>{!card.sentAt && ["Generated", "Draft"].includes(card.status) && <button className="q4-nav mt-2" disabled={busy} onClick={() => void send(card)}>{"Stuur"}</button>}{!card.sentAt && ["Sending","Failed"].includes(card.status) && <div className="mt-2 flex flex-wrap gap-2"><button disabled={busy} className="q4-nav" onClick={() => void review(card,true)}>Bevestig ontvangs</button>{["Sending", "Failed"].includes(card.status) && <button disabled={busy} className="q4-nav" onClick={() => void review(card,false)}>Bevestig nie afgelewer</button>}</div>}</td></tr>)}</tbody></table></div></div>
        {detail && <><div className="no-worker-print mt-5 flex flex-wrap items-center gap-3"><h3 className="text-xl font-semibold">{detail.jobCardNumber}</h3><select aria-label="Kies werkerkaart" value={worker} onChange={e => setWorker(e.target.value)} className="rounded-xl bg-zinc-900 p-3"><option value="all">Alle werkers</option>{groups.map(id => <option key={id} value={id}>{detail.items.find(item => String(item.workerID ?? "none") === id)?.workerName || "Nie toegeken nie"}</option>)}</select><button className="q4-nav" onClick={() => window.print()}>Druk {worker === "all" ? "alle kaarte" : "werkerkaart"}</button><button className="q4-nav" disabled={busy} onClick={() => void view(detail.jobCardID)}>Hergenereer drukweergawe</button><button className="q4-nav" onClick={() => setDetail(null)}>Sluit</button></div>
        <div className="worker-print-root mt-6">{groups.filter(id => worker === "all" || worker === id).map(id => {
            const items = detail.items.filter(item => String(item.workerID ?? "none") === id);
            return <article className="worker-print-card mb-5 rounded-xl border border-white/20 p-5" key={id}><h2 className="text-2xl font-bold">{items[0].workerName || "Nie toegeken nie"}</h2><p>NKRN · Logistics · {date(detail.jobCardDate)} · {detail.jobCardNumber}</p>{items.map(item => <div className="worker-print-item mt-4 border-t border-white/20 pt-3" key={item.jobCardItemID}><h3 className="font-semibold">{item.taskDescription}</h3><p>{item.area || "Geen gebied"} · {displayLabel(item.priority)} · {item.plannedStart?.slice(0, 5) || "Tyd nie vasgestel"}{item.plannedEnd ? ` – ${item.plannedEnd.slice(0, 5)}` : ""}</p><p>Materiaal: {item.materialsRequired || "Geen aangedui"}</p><p>Bestuurdersnota: {item.managerNote || "Geen"}</p><p>Status: {displayLabel(item.status)}</p><p className="mt-3">□ Afgehandel &nbsp; □ Opvolg &nbsp; Handtekening: __________________</p></div>)}</article>;
        })}</div></>}
    </section>;
}
