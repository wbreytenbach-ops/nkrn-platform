"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const API_URL = process.env.NEXT_PUBLIC_API_URL;
type LocationItem = { locationName?: string | null; locationText?: string | null; isPrimary?: boolean };
type EquipmentItem = { equipmentName?: string; quantity?: number | null; notes?: string | null };
type SecurityRequest = {
  requestID: number; requestedByName: string; requestedByEmail: string; requestType: string;
  title: string; description?: string | null; activityDate?: string | null; startTime?: string | null;
  endTime?: string | null; priority: string; status: string; createdDate: string;
  locations?: LocationItem[]; equipment?: EquipmentItem[];
};
function headers(): HeadersInit {
  const token = localStorage.getItem("token");
  return { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}
function dateText(value?: string | null) {
  if (!value) return "Nie gespesifiseer nie";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("af-ZA", { year: "numeric", month: "long", day: "numeric" });
}
function timeText(value?: string | null) { return value ? value.slice(0, 5) : "Nie gespesifiseer nie"; }
function descriptionField(value: string | null | undefined, label: string) {
  if (!value) return "";
  const line = value.split("\n").find(item => item.toLowerCase().startsWith(`${label.toLowerCase()}:`));
  return line ? line.slice(label.length + 1).trim() : "";
}
function guardCountText(value?: string | null) {
  return descriptionField(value, "Aantal wagte buite (Echo 1)") ||
    value?.match(/Aantal wagte benodig:\s*(\d+)/i)?.[1] ||
    descriptionField(value, "Aantal wagte") ||
    "Nie gespesifiseer nie";
}
function requirementsText(value?: string | null) {
  if (!value) return "Geen verdere vereistes verskaf nie.";
  const fields = ["Aantal wagte buite (Echo 1)", "Aantal wagte", "Skoolwagte benodig", "Parkering binne terrein", "Parkering vanaf", "Parkering tot"];
  const cleaned = value.split("\n").flatMap(line => {
    const trimmed = line.trim();
    if (trimmed.toLowerCase().startsWith("vereistes:")) {
      const detail = trimmed.slice("Vereistes:".length).trim();
      return detail ? [detail] : [];
    }
    if (fields.some(label => trimmed.toLowerCase().startsWith(`${label.toLowerCase()}:`))) return [];
    return trimmed ? [trimmed] : [];
  }).join("\n").trim();
  return cleaned || "Geen verdere vereistes verskaf nie.";
}

export default function LogisticsSecurityPortal() {
  const router = useRouter();
  const [requests, setRequests] = useState<SecurityRequest[]>([]);
  const [selected, setSelected] = useState<SecurityRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/api/LogisticsRequests`, { headers: headers(), cache: "no-store" });
      if (response.status === 401) { localStorage.removeItem("token"); localStorage.removeItem("user"); router.push("/login"); return; }
      if (!response.ok) throw new Error("Sekuriteitsversoeke kon nie gelaai word nie.");
      const data = await response.json() as SecurityRequest[];
      setRequests(data.filter(item => item.requestType?.toLowerCase() === "security"));
    } catch (e) { setError(e instanceof Error ? e.message : "Kon nie sekuriteitsversoeke laai nie."); }
    finally { setLoading(false); }
  }, [router]);
  useEffect(() => {
    const timeoutId = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [load]);
  async function open(id: number) {
    setError("");
    try {
      const response = await fetch(`${API_URL}/api/LogisticsRequests/${id}`, { headers: headers(), cache: "no-store" });
      if (!response.ok) throw new Error("Hierdie sekuriteitsversoek kon nie oopgemaak word nie.");
      const request = await response.json() as SecurityRequest;
      if (request.requestType?.toLowerCase() !== "security") throw new Error("Slegs sekuriteitsversoeke is beskikbaar.");
      setSelected(request);
    } catch (e) { setError(e instanceof Error ? e.message : "Kon nie die versoek oopmaak nie."); }
  }
  return <main className="nkrn-control min-h-screen bg-zinc-950 px-4 py-8 text-white sm:px-6 lg:px-10">
    <div className="mx-auto max-w-6xl">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div><p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-400">NKRN · Logistiek</p><h1 className="mt-2 text-3xl font-semibold">Sekuriteitsversoeke</h1><p className="mt-2 text-sm text-zinc-400">Sekuriteitsvereistes, datums, tye en liggings.</p></div>
        <button type="button" onClick={() => { setLoading(true); setError(""); void load(); }} disabled={loading} className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm hover:bg-white/10 disabled:opacity-50">{loading ? "Laai…" : "Verfris"}</button>
      </header>
      {error && <div role="alert" className="mb-5 rounded-xl border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-200">{error}</div>}
      <div className="grid gap-6 lg:grid-cols-[minmax(280px,0.8fr)_minmax(0,1.2fr)]">
        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><div className="mb-4 flex justify-between"><h2 className="font-semibold">Versoeke</h2><span className="rounded-full bg-white/10 px-3 py-1 text-xs">{requests.length}</span></div>
          {loading ? <p className="py-8 text-sm text-zinc-400">Versoeke word gelaai…</p> : requests.length === 0 ? <p className="py-8 text-sm text-zinc-400">Geen sekuriteitsversoeke beskikbaar nie.</p> : <div className="space-y-2">{requests.map(r => <button key={r.requestID} type="button" onClick={() => void open(r.requestID)} className={`w-full rounded-xl border p-4 text-left transition ${selected?.requestID === r.requestID ? "border-amber-400/50 bg-amber-400/10" : "border-white/10 bg-black/10 hover:bg-white/5"}`}><span className="block text-xs text-zinc-400">#{r.requestID} · {r.status}</span><span className="mt-1 block font-medium">{r.title}</span><span className="mt-1 block text-sm text-zinc-400">{dateText(r.activityDate)} · {r.requestedByName}</span></button>)}</div>}
        </section>
        <section className="min-h-72 rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-7">
          {!selected ? <div className="flex min-h-56 items-center justify-center text-center text-sm text-zinc-400">Kies ’n sekuriteitsversoek om die besonderhede te sien.</div> : <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-amber-400">Sekuriteitsversoek #{selected.requestID}</p><h2 className="mt-2 text-2xl font-semibold">{selected.title}</h2><p className="mt-2 text-sm text-zinc-400">{selected.status} · Prioriteit: {selected.priority}</p>
            <dl className="mt-6 grid gap-4 sm:grid-cols-2"><div><dt className="text-xs text-zinc-400">Versoek deur</dt><dd>{selected.requestedByName}</dd><dd className="text-sm text-zinc-400">{selected.requestedByEmail}</dd></div><div><dt className="text-xs text-zinc-400">Datum</dt><dd>{dateText(selected.activityDate)}</dd></div><div><dt className="text-xs text-zinc-400">Tyd</dt><dd>{timeText(selected.startTime)} – {timeText(selected.endTime)}</dd></div></dl>
            <h3 className="mt-6 text-sm font-semibold text-zinc-300">Wag- en parkeer-allokasie</h3>
             <dl className="mt-3 grid gap-3 sm:grid-cols-2">
               <div className="rounded-lg bg-black/20 p-3"><dt className="text-xs text-zinc-400">Wagte buite by Echo 1</dt><dd className="mt-1 text-sm font-medium">{guardCountText(selected.description)}</dd></div>
               <div className="rounded-lg bg-black/20 p-3"><dt className="text-xs text-zinc-400">Skoolwagte binne / by die hekke</dt><dd className="mt-1 text-sm font-medium">{descriptionField(selected.description, "Skoolwagte benodig") || "Geen aangedui nie"}</dd></div>
               <div className="rounded-lg bg-black/20 p-3"><dt className="text-xs text-zinc-400">Parkering binne skoolterrein</dt><dd className="mt-1 text-sm font-medium">{descriptionField(selected.description, "Parkering binne terrein") || "Nie aangedui nie"}</dd></div>
               <div className="rounded-lg bg-black/20 p-3"><dt className="text-xs text-zinc-400">Parkeringstye</dt><dd className="mt-1 text-sm font-medium">{descriptionField(selected.description, "Parkering vanaf") || "—"} – {descriptionField(selected.description, "Parkering tot") || "—"}</dd></div>
             </dl>
             <h3 className="mt-6 text-sm font-semibold text-zinc-300">Verdere vereistes / beskrywing</h3><p className="mt-2 whitespace-pre-wrap text-sm leading-6">{requirementsText(selected.description)}</p>
            <h3 className="mt-6 text-sm font-semibold text-zinc-300">Ligging</h3>{selected.locations?.length ? <ul className="mt-2 space-y-2">{selected.locations.map((l,i) => <li key={i} className="rounded-lg bg-black/20 px-3 py-2 text-sm">{l.locationName || l.locationText || "Ligging nie gespesifiseer nie"}{l.isPrimary ? " · Hoofligging" : ""}</li>)}</ul> : <p className="mt-2 text-sm text-zinc-400">Geen ligging gekoppel nie.</p>}
            {!!selected.equipment?.length && <><h3 className="mt-6 text-sm font-semibold text-zinc-300">Bykomende vereistes</h3><ul className="mt-2 space-y-2">{selected.equipment.map((e,i) => <li key={i} className="rounded-lg bg-black/20 px-3 py-2 text-sm">{e.equipmentName}{e.quantity != null ? ` · Aantal: ${e.quantity}` : ""}{e.notes ? ` · ${e.notes}` : ""}</li>)}</ul></>}
          </div>}
        </section>
      </div>
    </div>
  </main>;
}
