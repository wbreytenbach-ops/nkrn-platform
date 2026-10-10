"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

type SecurityLocation = {
    locationName?: string | null;
    locationText?: string | null;
    isPrimary?: boolean;
};

type SecurityRequest = {
    requestID: number;
    requestedByName: string;
    requestedByEmail: string;
    requestType: string;
    title: string;
    description?: string | null;
    activityDate?: string | null;
    startTime?: string | null;
    endTime?: string | null;
    priority: string;
    status: string;
    createdDate: string;
    locations?: SecurityLocation[];
};

function authHeaders(): HeadersInit {
    const token = localStorage.getItem("token");
    return {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
}

function dateText(value?: string | null) {
    if (!value) return "Nie gespesifiseer nie";
    const date = new Date(value);
    return Number.isNaN(date.getTime())
        ? value
        : date.toLocaleDateString("af-ZA", {
              year: "numeric",
              month: "long",
              day: "numeric",
          });
}

function timeText(value?: string | null) {
    return value ? value.slice(0, 5) : "Nie gespesifiseer nie";
}

const inputClass =
    "mt-1 w-full rounded-xl border border-white/10 bg-zinc-900/80 px-3.5 py-3 text-sm text-white outline-none focus:border-amber-400/60";

export default function LogisticsSecurityPortal() {
    const router = useRouter();
    const [requests, setRequests] = useState<SecurityRequest[]>([]);
    const [selected, setSelected] = useState<SecurityRequest | null>(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [formOpen, setFormOpen] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    const [title, setTitle] = useState("");
    const [activityDate, setActivityDate] = useState("");
    const [startTime, setStartTime] = useState("");
    const [endTime, setEndTime] = useState("");
    const [location, setLocation] = useState("");
    const [guardCount, setGuardCount] = useState("1");
    const [requirements, setRequirements] = useState("");

    const load = useCallback(async () => {
        try {
            setError("");
            const response = await fetch(`${API_URL}/api/LogisticsRequests`, {
                headers: authHeaders(),
                cache: "no-store",
            });

            if (response.status === 401) {
                localStorage.removeItem("token");
                localStorage.removeItem("user");
                router.replace("/login");
                return;
            }

            if (!response.ok) {
                throw new Error(
                    `Sekuriteitsversoeke kon nie gelaai word nie (${response.status}).`
                );
            }

            const data = (await response.json()) as SecurityRequest[];
            const securityRequests = data.filter(
                (item) => item.requestType?.toLowerCase() === "security"
            );
            setRequests(securityRequests);
            setSelected((current) =>
                current
                    ? securityRequests.find(
                          (item) => item.requestID === current.requestID
                      ) ?? null
                    : null
            );
        } catch (loadError) {
            setError(
                loadError instanceof Error
                    ? loadError.message
                    : "Kon nie sekuriteitsversoeke laai nie."
            );
        } finally {
            setLoading(false);
        }
    }, [router]);

    useEffect(() => {
        void load();
    }, [load]);

    async function openRequest(id: number) {
        setError("");
        try {
            const response = await fetch(
                `${API_URL}/api/LogisticsRequests/${id}`,
                { headers: authHeaders(), cache: "no-store" }
            );

            if (!response.ok) {
                throw new Error(
                    "Hierdie sekuriteitsversoek kon nie oopgemaak word nie."
                );
            }

            const request = (await response.json()) as SecurityRequest;
            if (request.requestType?.toLowerCase() !== "security") {
                throw new Error("Slegs sekuriteitsversoeke is beskikbaar.");
            }
            setSelected(request);
        } catch (openError) {
            setError(
                openError instanceof Error
                    ? openError.message
                    : "Kon nie die versoek oopmaak nie."
            );
        }
    }

    function resetForm() {
        setTitle("");
        setActivityDate("");
        setStartTime("");
        setEndTime("");
        setLocation("");
        setGuardCount("1");
        setRequirements("");
    }

    async function submitRequest(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setError("");
        setSuccess("");

        if (endTime <= startTime) {
            setError("Die eindtyd moet ná die begintyd wees.");
            return;
        }

        const count = Number(guardCount);
        if (!Number.isInteger(count) || count < 1) {
            setError("Voer asseblief 'n geldige aantal wagte in.");
            return;
        }

        setSubmitting(true);
        try {
            const description =
                `Aantal wagte: ${count}\\nVereistes: ${requirements.trim()}`;

            const response = await fetch(`${API_URL}/api/LogisticsRequests`, {
                method: "POST",
                headers: authHeaders(),
                body: JSON.stringify({
                    requestType: "Security",
                    activityCategory: null,
                    title: title.trim(),
                    description,
                    activityDate,
                    startTime,
                    endTime,
                    cleanupNextDay: null,
                    locations: [
                        {
                            locationID: null,
                            locationText: location.trim(),
                            isPrimary: true,
                        },
                    ],
                    equipment: [],
                    maintenanceItems: [],
                }),
            });

            if (response.status === 401) {
                localStorage.removeItem("token");
                localStorage.removeItem("user");
                router.replace("/login");
                return;
            }

            if (!response.ok) {
                const body = await response.text();
                throw new Error(
                    body || `Die versoek kon nie gestuur word nie (${response.status}).`
                );
            }

            const created = (await response.json()) as SecurityRequest;
            setSuccess("Sekuriteitsversoek suksesvol ingedien.");
            setFormOpen(false);
            resetForm();
            await load();
            if (created.requestID) {
                await openRequest(created.requestID);
            }
        } catch (submitError) {
            setError(
                submitError instanceof Error
                    ? submitError.message
                    : "Die sekuriteitsversoek kon nie gestuur word nie."
            );
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <main className="nkrn-control min-h-screen bg-zinc-950 px-4 py-8 text-white sm:px-6 lg:px-10">
            <div className="mx-auto max-w-6xl">
                <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-400">
                            NKRN · Logistiek
                        </p>
                        <h1 className="mt-2 text-3xl font-semibold">
                            Sekuriteitsversoeke
                        </h1>
                        <p className="mt-2 text-sm text-zinc-400">
                            Skep sekuriteitsversoeke en sien die waggetal, tye,
                            liggings en vereistes. Hierdie werkruimte wys slegs
                            sekuriteitsversoeke.
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <button
                            type="button"
                            onClick={() => router.push("/")}
                            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm hover:bg-white/10"
                        >
                            Terug na NKRN
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setError("");
                                setSuccess("");
                                setFormOpen((open) => !open);
                            }}
                            className="rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-2.5 text-sm font-semibold text-amber-200 hover:bg-amber-400/15"
                        >
                            {formOpen ? "Maak vorm toe" : "+ Nuwe sekuriteitsversoek"}
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setLoading(true);
                                void load();
                            }}
                            disabled={loading}
                            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm hover:bg-white/10 disabled:opacity-50"
                        >
                            {loading ? "Laai…" : "Verfris"}
                        </button>
                    </div>
                </header>

                {error && (
                    <div
                        role="alert"
                        className="mb-5 rounded-xl border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-200"
                    >
                        {error}
                    </div>
                )}
                {success && (
                    <div
                        role="status"
                        className="mb-5 rounded-xl border border-emerald-400/30 bg-emerald-400/10 p-4 text-sm text-emerald-200"
                    >
                        {success}
                    </div>
                )}

                {formOpen && (
                    <form
                        onSubmit={submitRequest}
                        className="mb-8 rounded-2xl border border-amber-400/20 bg-white/[0.03] p-5 sm:p-7"
                    >
                        <h2 className="text-xl font-semibold">
                            Nuwe sekuriteitsversoek
                        </h2>
                        <p className="mt-1 text-sm text-zinc-400">
                            Vul die besonderhede in. Slegs die Security-versoektipe
                            is beskikbaar vir hierdie rekening.
                        </p>
                        <div className="mt-5 grid gap-4 sm:grid-cols-2">
                            <label className="text-sm text-zinc-300">
                                Versoek / geleentheid
                                <input
                                    className={inputClass}
                                    value={title}
                                    onChange={(event) => setTitle(event.target.value)}
                                    required
                                    maxLength={200}
                                    placeholder="bv. Sportdag-sekuriteit"
                                />
                            </label>
                            <label className="text-sm text-zinc-300">
                                Ligging
                                <input
                                    className={inputClass}
                                    value={location}
                                    onChange={(event) => setLocation(event.target.value)}
                                    required
                                    placeholder="Waar is die wagte nodig?"
                                />
                            </label>
                            <label className="text-sm text-zinc-300">
                                Datum
                                <input
                                    type="date"
                                    className={inputClass}
                                    value={activityDate}
                                    onChange={(event) => setActivityDate(event.target.value)}
                                    required
                                />
                            </label>
                            <label className="text-sm text-zinc-300">
                                Aantal wagte
                                <input
                                    type="number"
                                    min={1}
                                    step={1}
                                    className={inputClass}
                                    value={guardCount}
                                    onChange={(event) => setGuardCount(event.target.value)}
                                    required
                                />
                            </label>
                            <label className="text-sm text-zinc-300">
                                Begintyd
                                <input
                                    type="time"
                                    className={inputClass}
                                    value={startTime}
                                    onChange={(event) => setStartTime(event.target.value)}
                                    required
                                />
                            </label>
                            <label className="text-sm text-zinc-300">
                                Eindtyd
                                <input
                                    type="time"
                                    className={inputClass}
                                    value={endTime}
                                    onChange={(event) => setEndTime(event.target.value)}
                                    required
                                />
                            </label>
                            <label className="text-sm text-zinc-300 sm:col-span-2">
                                Vereistes / instruksies
                                <textarea
                                    className={inputClass}
                                    value={requirements}
                                    onChange={(event) => setRequirements(event.target.value)}
                                    required
                                    rows={4}
                                    placeholder="Beskryf die vereistes, toegangspunte, spesiale instruksies en enige ander belangrike besonderhede."
                                />
                            </label>
                        </div>
                        <div className="mt-5 flex flex-wrap gap-3">
                            <button
                                type="submit"
                                disabled={submitting}
                                className="rounded-xl border border-amber-400/30 bg-amber-400/15 px-5 py-3 text-sm font-semibold text-amber-100 hover:bg-amber-400/20 disabled:opacity-50"
                            >
                                {submitting ? "Besig om in te dien…" : "Dien sekuriteitsversoek in"}
                            </button>
                            <button
                                type="button"
                                disabled={submitting}
                                onClick={() => {
                                    setFormOpen(false);
                                    resetForm();
                                }}
                                className="rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm hover:bg-white/10 disabled:opacity-50"
                            >
                                Kanselleer
                            </button>
                        </div>
                    </form>
                )}

                <div className="grid gap-6 lg:grid-cols-[minmax(280px,0.8fr)_minmax(0,1.2fr)]">
                    <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                        <div className="mb-4 flex justify-between">
                            <h2 className="font-semibold">Sekuriteitsversoeke</h2>
                            <span className="rounded-full bg-white/10 px-3 py-1 text-xs">
                                {requests.length}
                            </span>
                        </div>
                        {loading ? (
                            <p className="py-8 text-sm text-zinc-400">
                                Versoeke word gelaai…
                            </p>
                        ) : requests.length === 0 ? (
                            <p className="py-8 text-sm text-zinc-400">
                                Geen sekuriteitsversoeke beskikbaar nie.
                            </p>
                        ) : (
                            <div className="space-y-2">
                                {requests.map((request) => (
                                    <button
                                        key={request.requestID}
                                        type="button"
                                        onClick={() => void openRequest(request.requestID)}
                                        className={`w-full rounded-xl border p-4 text-left transition ${selected?.requestID === request.requestID ? "border-amber-400/50 bg-amber-400/10" : "border-white/10 bg-black/10 hover:bg-white/5"}`}
                                    >
                                        <span className="block text-xs text-zinc-400">
                                            #{request.requestID} · {request.status}
                                        </span>
                                        <span className="mt-1 block font-medium">
                                            {request.title}
                                        </span>
                                        <span className="mt-1 block text-sm text-zinc-400">
                                            {dateText(request.activityDate)} · {request.requestedByName}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </section>

                    <section className="min-h-72 rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-7">
                        {!selected ? (
                            <div className="flex min-h-56 items-center justify-center text-center text-sm text-zinc-400">
                                Kies ’n sekuriteitsversoek om die besonderhede te sien.
                            </div>
                        ) : (
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-wider text-amber-400">
                                    Sekuriteitsversoek #{selected.requestID}
                                </p>
                                <h2 className="mt-2 text-2xl font-semibold">
                                    {selected.title}
                                </h2>
                                <p className="mt-2 text-sm text-zinc-400">
                                    {selected.status} · Prioriteit: {selected.priority}
                                </p>
                                <dl className="mt-6 grid gap-4 sm:grid-cols-2">
                                    <div>
                                        <dt className="text-xs text-zinc-400">Versoek deur</dt>
                                        <dd>{selected.requestedByName}</dd>
                                        <dd className="text-sm text-zinc-400">
                                            {selected.requestedByEmail}
                                        </dd>
                                    </div>
                                    <div>
                                        <dt className="text-xs text-zinc-400">Datum</dt>
                                        <dd>{dateText(selected.activityDate)}</dd>
                                    </div>
                                    <div>
                                        <dt className="text-xs text-zinc-400">Tyd</dt>
                                        <dd>{timeText(selected.startTime)} – {timeText(selected.endTime)}</dd>
                                    </div>
                                </dl>
                                <h3 className="mt-6 text-sm font-semibold text-zinc-300">
                                    Vereistes / beskrywing
                                </h3>
                                <p className="mt-2 whitespace-pre-wrap text-sm leading-6">
                                    {selected.description || "Geen verdere beskrywing verskaf nie."}
                                </p>
                                <h3 className="mt-6 text-sm font-semibold text-zinc-300">
                                    Ligging
                                </h3>
                                {selected.locations?.length ? (
                                    <ul className="mt-2 space-y-2">
                                        {selected.locations.map((item, index) => (
                                            <li
                                                key={index}
                                                className="rounded-lg bg-black/20 px-3 py-2 text-sm"
                                            >
                                                {item.locationName || item.locationText || "Ligging nie gespesifiseer nie"}
                                                {item.isPrimary ? " · Hoofligging" : ""}
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <p className="mt-2 text-sm text-zinc-400">
                                        Geen ligging gekoppel nie.
                                    </p>
                                )}
                            </div>
                        )}
                    </section>
                </div>
            </div>
        </main>
    );
}
