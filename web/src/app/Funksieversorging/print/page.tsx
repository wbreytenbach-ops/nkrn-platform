"use client";

import { useEffect, useState } from "react";
import "./print.css";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

type PrintItem = {
    code: string;
    name: string;
    category: string;
    requestedQuantity: number;
    recordedAvailableQuantity: number | null;
    isAttendanceDerived: boolean;
};

type PrintRequest = {
    requestID: number;
    requesterName: string;
    requesterEmail: string;
    neededDate: string;
    functionName: string;
    venue: string;
    otherVenue: string | null;
    attendance: number;
    status: string;
    leadTimeWarning: boolean;
    items: PrintItem[];
};

function formatDate(value: string) {
    if (!value) return "—";
    return new Intl.DateTimeFormat("af-ZA", { dateStyle: "long" }).format(new Date(value));
}

export default function FunksieversorgingPrintPage() {
    const [request, setRequest] = useState<PrintRequest | null>(null);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;

        async function loadRequest() {
            const params = new URLSearchParams(window.location.search);
            const requestID = params.get("requestID");
            const expires = params.get("expires");
            const signature = params.get("signature");

            if (!requestID || !expires || !signature || !/^\d+$/.test(requestID) || !/^\d+$/.test(expires)) {
                setError("Hierdie drukskakel is ongeldig. Gebruik asseblief die skakel in die oorspronklike e-pos.");
                setLoading(false);
                return;
            }

            try {
                const baseUrl = (API_URL || window.location.origin).replace(/\/+$/, "");
                const response = await fetch(
                    `${baseUrl}/api/FunksieversorgingRequests/print/${encodeURIComponent(requestID)}?expires=${encodeURIComponent(expires)}&signature=${encodeURIComponent(signature)}`,
                    { cache: "no-store" },
                );

                if (!response.ok) {
                    throw new Error(response.status === 404
                        ? "Hierdie drukskakel het verval of is ongeldig. Vra asseblief vir ’n nuwe versoek-e-pos."
                        : "Die versoek kon nie gelaai word nie. Probeer asseblief weer.");
                }

                const data = await response.json() as PrintRequest;
                if (!cancelled) {
                    setRequest(data);
                    setLoading(false);
                    window.setTimeout(() => {
                        if (!cancelled) window.print();
                    }, 500);
                }
            } catch (loadError) {
                if (!cancelled) {
                    setError(loadError instanceof Error ? loadError.message : "Die versoek kon nie gelaai word nie.");
                    setLoading(false);
                }
            }
        }

        void loadRequest();
        return () => { cancelled = true; };
    }, []);

    if (loading) {
        return <main className="fv-print-state"><p>Laai drukbare versoek…</p></main>;
    }

    if (error || !request) {
        return (
            <main className="fv-print-state">
                <h1>Druk hardekopie van versoek</h1>
                <p role="alert">{error || "Die versoek is nie beskikbaar nie."}</p>
                <button type="button" onClick={() => window.close()}>Maak venster toe</button>
            </main>
        );
    }

    return (
        <main className="fv-print-page">
            <div className="fv-print-actions" aria-label="Drukaksies">
                <p>Die drukvenster behoort outomaties oop te maak. Kies jou drukker en kopieë daar.</p>
                <button type="button" onClick={() => window.print()}>Druk hardekopie</button>
                <button type="button" className="secondary" onClick={() => window.close()}>Maak venster toe</button>
            </div>

            <article className="fv-print-sheet">
                <header className="fv-print-header">
                    <div>
                        <p className="fv-print-eyebrow">Laerskool Tygerpoort · Tygies 1</p>
                        <h1>Funksieversorging</h1>
                        <p>Hardekopie van voorraadversoek</p>
                    </div>
                    <div className="fv-print-number">
                        <span>VERSOEK</span>
                        <strong>#{request.requestID}</strong>
                    </div>
                </header>

                {request.leadTimeWarning && (
                    <p className="fv-print-warning">
                        Let wel: Hierdie versoek is binne drie werksdae van die funksiedatum ingedien.
                    </p>
                )}

                <section className="fv-print-details">
                    <h2>Funksiebesonderhede</h2>
                    <dl>
                        <div><dt>Funksie</dt><dd>{request.functionName}</dd></div>
                        <div><dt>Datum benodig</dt><dd>{formatDate(request.neededDate)}</dd></div>
                        <div><dt>Lokaal</dt><dd>{request.venue === "Ander" ? request.otherVenue || request.venue : request.venue}</dd></div>
                        <div><dt>Aantal persone</dt><dd>{request.attendance}</dd></div>
                        <div><dt>Ingedien deur</dt><dd>{request.requesterName}</dd></div>
                        <div><dt>E-pos</dt><dd>{request.requesterEmail}</dd></div>
                    </dl>
                </section>

                <section className="fv-print-inventory">
                    <h2>Gekose voorraad</h2>
                    <table>
                        <thead><tr><th>Item</th><th>Kategorie</th><th>Benodig</th><th>Aangetekende voorraad</th></tr></thead>
                        <tbody>
                            {request.items.map((item) => (
                                <tr key={item.code}>
                                    <td>{item.name}</td>
                                    <td>{item.category}</td>
                                    <td>{item.requestedQuantity}</td>
                                    <td>{item.recordedAvailableQuantity ?? "Nie vasgelê nie"}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </section>

                <section className="fv-print-return">
                    <h2>Terugbesorging en verantwoordelikheid</h2>
                    <p>Geleende voorraad moet skoongemaak en volgens afspraak terugbesorg word. Skade of breuke moet aangemeld word.</p>
                    <div className="fv-print-signatures">
                        <div><span>Uitgereik deur</span></div>
                        <div><span>Ontvang deur</span></div>
                        <div><span>Datum</span></div>
                    </div>
                </section>

                <footer className="fv-print-footer">
                    <span>Laerskool Tygerpoort</span>
                    <span>Funksieversorging · Versoek #{request.requestID}</span>
                </footer>
            </article>
        </main>
    );
}
