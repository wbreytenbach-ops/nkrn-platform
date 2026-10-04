"use client";

import { useMemo, useState } from "react";
import {
    completeAiHelp,
    startAiHelp,
    type AiTriageResult,
} from "@/services/aiService";

type ModuleKey = "IT" | "Logistics" | "Funksieversorging";

interface Props {
    moduleKey?: ModuleKey;
    description: string;
    additionalContext?: string;
    disabled?: boolean;
    onSuggestedTitle?: (title: string) => void;
    onSuggestedRequestType?: (value: "Event" | "Maintenance" | "General") => void;
    onSuggestedCategory?: (value: string) => void;
    onSessionStarted?: (sessionID: string | null) => void;
    onResolved?: () => void;
    onLogRequest?: (sessionID: string | null) => void | Promise<void>;
}

const priorityLabel: Record<string, string> = {
    Low: "Laag",
    Medium: "Medium",
    High: "Hoog",
    Critical: "Kritiek",
};

export default function ItAiAssistant({
    moduleKey = "IT",
    description,
    additionalContext,
    disabled = false,
    onSuggestedTitle,
    onSuggestedRequestType,
    onSuggestedCategory,
    onSessionStarted,
    onResolved,
    onLogRequest,
}: Props) {
    const [loading, setLoading] = useState(false);
    const [savingOutcome, setSavingOutcome] = useState(false);
    const [result, setResult] = useState<AiTriageResult | null>(null);
    const [error, setError] = useState("");
    const [responseText, setResponseText] = useState("");

    const isCritical = result?.suggestedPriority === "Critical";

    const intro = useMemo(() => {
        if (moduleKey === "Logistics") {
            return "Beskryf wat fout is of wat benodig word. NKRN bepaal die waarskynlike soort versoek en prioriteit.";
        }

        if (moduleKey === "Funksieversorging") {
            return "NKRN kan die besonderhede nagaan voordat jy die versoek indien.";
        }

        return "Laat NKRN eers die probleem ontleed en probeer help.";
    }, [moduleKey]);

    async function analyse() {
        if (description.trim().length < 5) {
            setError("Beskryf eers waarmee jy hulp nodig het.");
            return;
        }

        setLoading(true);
        setError("");

        try {
            const response = await startAiHelp({
                moduleKey,
                description,
                additionalContext,
            });

            setResult(response);
            onSessionStarted?.(response.sessionID);

            if (response.suggestedTitle) {
                onSuggestedTitle?.(response.suggestedTitle);
            }

            if (response.suggestedRequestType) {
                onSuggestedRequestType?.(response.suggestedRequestType);
            }

            if (response.suggestedCategory) {
                onSuggestedCategory?.(response.suggestedCategory);
            }
        } catch (requestError) {
            console.error("NKRN AI help failed.", requestError);
            setError(
                "NKRN AI is nie tans beskikbaar nie. Jy kan steeds die versoek indien."
            );
        } finally {
            setLoading(false);
        }
    }

    async function resolved(userResponse?: string) {
        if (!result) return;

        setSavingOutcome(true);
        setError("");

        try {
            if (result.sessionID) {
                await completeAiHelp({
                    sessionID: result.sessionID,
                    outcome: "ResolvedByAI",
                    userResponse,
                });
            }

            setResult(null);
            setResponseText("");
            onResolved?.();
        } catch (outcomeError) {
            console.error("Unable to save AI outcome.", outcomeError);
            setError("Die uitkoms kon nie gestoor word nie. Probeer weer.");
        } finally {
            setSavingOutcome(false);
        }
    }

    async function logRequest(userResponse?: string) {
        if (!result) return;

        setSavingOutcome(true);
        setError("");

        try {
            if (result.sessionID && userResponse?.trim()) {
                await completeAiHelp({
                    sessionID: result.sessionID,
                    outcome: "HumanRequired",
                    userResponse,
                });
            }

            await onLogRequest?.(result.sessionID);
        } catch (outcomeError) {
            console.error("Unable to continue AI request flow.", outcomeError);
            setError("Die versoek kon nie vanaf die AI-hulp voortgaan nie.");
        } finally {
            setSavingOutcome(false);
        }
    }

    async function handleNaturalResponse() {
        const value = responseText.trim().toLowerCase();

        if (!value) return;

        const resolvedWords =
            /\b(reggekom|reg gekom|opgelos|werk nou|dit werk|sukses|dankie)\b/i;

        const logWords =
            /\b(werk nie|nie reggekom|nie opgelos|log|dien|versoek|help nog|steeds nie)\b/i;

        if (logWords.test(value)) {
            await logRequest(responseText);
            return;
        }

        if (resolvedWords.test(value)) {
            await resolved(responseText);
            return;
        }

        setError(
            "Ek is nie seker watter uitkoms jy bedoel nie. Kies asseblief een van die twee opsies hieronder."
        );
    }

    return (
        <div className="mt-4 rounded-2xl border border-[#d7a31f]/20 bg-[#d7a31f]/5 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <p className="text-sm font-semibold text-zinc-100">
                        NKRN AI-hulp
                    </p>
                    <p className="mt-1 text-xs leading-5 text-zinc-400">
                        {intro}
                    </p>
                </div>

                <button
                    type="button"
                    onClick={analyse}
                    disabled={
                        disabled ||
                        loading ||
                        description.trim().length < 5
                    }
                    className="shrink-0 rounded-xl border border-[#d7a31f]/30 bg-[#d7a31f]/10 px-4 py-2.5 text-sm font-medium text-[#e7b42b] transition hover:bg-[#d7a31f]/15 disabled:cursor-not-allowed disabled:opacity-50"
                >
                    {loading ? "Besig om na te gaan…" : "Kry AI-hulp"}
                </button>
            </div>

            {error && (
                <p role="alert" className="mt-3 text-sm text-red-300">
                    {error}
                </p>
            )}

            {result && (
                <div className="mt-4 space-y-4 border-t border-white/10 pt-4">
                    <p className="text-sm leading-6 text-zinc-200">
                        {result.userMessage}
                    </p>

                    {result.troubleshootingSteps.length > 0 && (
                        <div>
                            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
                                Probeer dit
                            </p>
                            <ol className="space-y-2 text-sm text-zinc-300">
                                {result.troubleshootingSteps.map((step, index) => (
                                    <li key={`${index}-${step}`} className="flex gap-3">
                                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-xs text-zinc-400">
                                            {index + 1}
                                        </span>
                                        <span className="pt-0.5">{step}</span>
                                    </li>
                                ))}
                            </ol>
                        </div>
                    )}

                    <div className="grid gap-3 text-xs sm:grid-cols-2">
                        <div className="rounded-xl border border-white/10 bg-black/10 p-3">
                            <span className="text-zinc-500">Kategorie</span>
                            <p className="mt-1 text-sm text-zinc-200">
                                {result.suggestedCategory ??
                                    (moduleKey === "IT"
                                        ? "IT-span sal klassifiseer"
                                        : "Word by indiening bevestig")}
                            </p>
                        </div>

                        <div className="rounded-xl border border-white/10 bg-black/10 p-3">
                            <span className="text-zinc-500">Prioriteit</span>
                            <p
                                className={`mt-1 text-sm ${
                                    isCritical ? "font-semibold text-red-300" : "text-zinc-200"
                                }`}
                            >
                                {priorityLabel[result.suggestedPriority] ??
                                    result.suggestedPriority}
                            </p>
                        </div>
                    </div>

                    <div className="rounded-xl border border-white/10 bg-black/10 p-3">
                        <label className="text-xs text-zinc-500">
                            Jy kan ook antwoord wat gebeur het
                        </label>
                        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                            <input
                                value={responseText}
                                onChange={(event) => setResponseText(event.target.value)}
                                placeholder="bv. Ek het reggekom / Dit werk nog nie"
                                className="nkrn-input min-w-0 flex-1 rounded-xl border border-white/10 bg-zinc-900/70 px-3.5 py-2.5 text-sm text-white outline-none"
                            />
                            <button
                                type="button"
                                onClick={() => void handleNaturalResponse()}
                                disabled={savingOutcome || !responseText.trim()}
                                className="rounded-xl border border-white/10 bg-white/6 px-4 py-2.5 text-sm text-zinc-200 disabled:opacity-50"
                            >
                                Stuur antwoord
                            </button>
                        </div>
                    </div>

                    <div className="flex flex-col gap-2 sm:flex-row">
                        <button
                            type="button"
                            onClick={() => void resolved("Ek het reggekom.")}
                            disabled={savingOutcome}
                            className="rounded-xl border border-green-400/20 bg-green-500/10 px-4 py-2.5 text-sm font-medium text-green-300 disabled:opacity-50"
                        >
                            Ek het reggekom
                        </button>

                        <button
                            type="button"
                            onClick={() => void logRequest("Dit werk steeds nie. Dien die versoek in.")}
                            disabled={savingOutcome}
                            className={`rounded-xl border px-4 py-2.5 text-sm font-medium disabled:opacity-50 ${
                                isCritical
                                    ? "border-red-400/25 bg-red-500/12 text-red-300"
                                    : "border-[#d7a31f]/30 bg-[#d7a31f]/10 text-[#e7b42b]"
                            }`}
                        >
                            {isCritical
                                ? "Dien dringende versoek in"
                                : "Dit werk steeds nie – dien versoek in"}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
