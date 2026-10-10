"use client";

import { useEffect, useState } from "react";
import { useLanguage, type Language } from "../../language";
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
    notes: string | null;
    createdAt: string;
    items: PrintItem[];
};

function formatDate(value: string, language: Language) {
    if (!value) return "—";
    return new Intl.DateTimeFormat(language === "en" ? "en-ZA" : "af-ZA", { dateStyle: "long" }).format(new Date(value));
}

const printErrorTranslations: Record<string, string> = {
    "Hierdie drukskakel is ongeldig. Gebruik asseblief die skakel in die oorspronklike e-pos.": "This print link is invalid. Please use the link in the original email.",
    "Hierdie drukskakel het verval of is ongeldig. Vra asseblief vir ’n nuwe versoek-e-pos.": "This print link has expired or is invalid. Please request a new request email.",
    "Die versoek kon nie gelaai word nie. Probeer asseblief weer.": "The request could not be loaded. Please try again.",
    "Die versoek is nie beskikbaar nie.": "The request is not available.",
};

export default function FunksieversorgingPrintPage() {
    const { language } = useLanguage();
    const english = language === "en";
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
        return <main className="fv-print-state"><p>{english ? "Loading printable request…" : "Laai drukbare versoek…"}</p></main>;
    }

    if (error || !request) {
        return (
            <main className="fv-print-state">
                <h1>{english ? "Printable request" : "Druk hardekopie van versoek"}</h1>
                <p role="alert">{english ? (printErrorTranslations[error] || error || "The request is not available.") : (error || "Die versoek is nie beskikbaar nie.")}</p>
                <button type="button" onClick={() => window.close()}>{english ? "Close window" : "Maak venster toe"}</button>
            </main>
        );
    }

    return (
        <main className="fv-print-page">
            <div className="fv-print-actions" aria-label={english ? "Print actions" : "Drukaksies"}>
                <p>{english ? "The print dialog should open automatically. Choose your printer and number of copies there." : "Die drukvenster behoort outomaties oop te maak. Kies jou drukker en kopieë daar."}</p>
                <button type="button" onClick={() => window.print()}>{english ? "Print request" : "Druk hardekopie"}</button>
                <button type="button" className="secondary" onClick={() => window.close()}>{english ? "Close window" : "Maak venster toe"}</button>
            </div>

            <article className="fv-print-sheet">
                <header className="fv-print-header">
                    <div>
                        <p className="fv-print-eyebrow">Laerskool Tygerpoort · Tygies One</p>
                        <h1>{english ? "Event Support" : "Funksieversorging"}</h1>
                        <p>{english ? "Printable supplies request" : "Hardekopie van voorraadversoek"}</p>
                    </div>
                    <div className="fv-print-number">
                        <span>{english ? "REQUEST" : "VERSOEK"}</span>
                        <strong>#{request.requestID}</strong>
                    </div>
                </header>

                {request.leadTimeWarning && (
                    <p className="fv-print-warning">
                        {english ? "Note: This request was submitted within three working days of the event date." : "Let wel: Hierdie versoek is binne drie werksdae van die funksiedatum ingedien."}
                    </p>
                )}

                <section className="fv-print-details">
                    <h2>{english ? "Event details" : "Funksiebesonderhede"}</h2>
                    <dl>
                        <div><dt>{english ? "Event" : "Funksie"}</dt><dd>{request.functionName}</dd></div>
                        <div><dt>{english ? "Date required" : "Datum benodig"}</dt><dd>{formatDate(request.neededDate, language)}</dd></div>
                        <div><dt>{english ? "Venue" : "Lokaal"}</dt><dd>{request.venue === "Ander" ? request.otherVenue || request.venue : request.venue}</dd></div>
                        <div><dt>{english ? "Attendance" : "Aantal persone"}</dt><dd>{request.attendance}</dd></div>
                        <div><dt>{english ? "Submitted by" : "Ingedien deur"}</dt><dd>{request.requesterName}</dd></div>
                        <div><dt>{english ? "Email" : "E-pos"}</dt><dd>{request.requesterEmail}</dd></div>
                        <div><dt>{english ? "Submitted on" : "Ingedien op"}</dt><dd>{formatDate(request.createdAt, language)}</dd></div>
                        <div><dt>{english ? "Status" : "Status"}</dt><dd>{request.status}</dd></div>
                    </dl>
                </section>

                <section className="fv-print-inventory">
                    <h2>{english ? "Requested supplies" : "Gekose voorraad"}</h2>
                    <table>
                        <thead><tr><th>{english ? "Item" : "Item"}</th><th>{english ? "Category" : "Kategorie"}</th><th>{english ? "Quantity" : "Benodig"}</th><th>{english ? "Recorded stock" : "Aangetekende voorraad"}</th></tr></thead>
                        <tbody>
                            {request.items.map((item) => (
                                <tr key={item.code}>
                                    <td>{item.name}</td>
                                    <td>{item.category}</td>
                                    <td>{item.requestedQuantity}</td>
                                    <td>{item.recordedAvailableQuantity ?? (english ? "Not recorded" : "Nie vasgelê nie")}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </section>

                {request.notes && (
                    <section className="fv-print-return">
                        <h2>{english ? "Additional note" : "Bykomende nota"}</h2>
                        <p>{request.notes}</p>
                    </section>
                )}

                <section className="fv-print-return">
                    <h2>{english ? "Returns and responsibility" : "Terugbesorging en verantwoordelikheid"}</h2>
                    <p>{english ? "Borrowed supplies must be cleaned and returned as agreed. Damage or breakages must be reported." : "Geleende voorraad moet skoongemaak en volgens afspraak terugbesorg word. Skade of breuke moet aangemeld word."}</p>
                    <div className="fv-print-signatures">
                        <div><span>{english ? "Issued by" : "Uitgereik deur"}</span></div>
                        <div><span>{english ? "Received by" : "Ontvang deur"}</span></div>
                        <div><span>{english ? "Date" : "Datum"}</span></div>
                    </div>
                </section>

                <footer className="fv-print-footer">
                    <span>Laerskool Tygerpoort</span>
                    <span>{english ? `Event Support · Request #${request.requestID}` : `Funksieversorging · Versoek #${request.requestID}`}</span>
                </footer>
            </article>
        </main>
    );
}
