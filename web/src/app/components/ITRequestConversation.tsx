"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLanguage } from "../language";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

type ChatUser = { userID: number; firstName: string; lastName: string; email: string };
type ChatMessage = {
    commentID: number;
    requestID: number;
    userID: number;
    commentText: string;
    createdDate: string | null;
    user?: { firstName: string; lastName: string };
};

function headers(): HeadersInit {
    const token = localStorage.getItem("token");
    return {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {})
    };
}

export default function ITRequestConversation({
    requestID,
    compact = false,
}: {
    requestID: number;
    compact?: boolean;
}) {
    const { language } = useLanguage();
    const af = language === "af";
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [users, setUsers] = useState<ChatUser[]>([]);
    const [text, setText] = useState("");
    const [mentions, setMentions] = useState<number[]>([]);
    const [busy, setBusy] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [open, setOpen] = useState(!compact);

    const load = useCallback(async () => {
        const response = await fetch(`${API_URL}/api/RequestComments/request/${requestID}`, {
            headers: headers(), cache: "no-store"
        });
        if (!response.ok) throw new Error(`Chat HTTP ${response.status}`);
        const data = await response.json() as ChatMessage[];
        setMessages(data);
    }, [requestID]);

    useEffect(() => {
        if (!open) return;
        let cancelled = false;
        const refresh = async () => {
            try {
                const response = await fetch(
                    `${API_URL}/api/RequestComments/request/${requestID}`,
                    { headers: headers(), cache: "no-store" }
                );
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                const messages = await response.json() as ChatMessage[];
                if (!cancelled) {
                    setMessages(messages);
                    setLoading(false);
                    setError("");
                }
            } catch {
                if (!cancelled) {
                    setLoading(false);
                    setError(af ? "Kon nie gesprek laai nie." : "Could not load the conversation.");
                }
            }
        };
        void refresh();
        const interval = window.setInterval(() => {
            if (document.visibilityState === "visible") void refresh();
        }, 20000);
        return () => { cancelled = true; window.clearInterval(interval); };
    }, [requestID, open, af]);

    useEffect(() => {
        if (!open) return;
        let cancelled = false;
        const read = async () => {
            try {
                const response = await fetch(
                    `${API_URL}/api/RequestComments/mentionable/${requestID}`,
                    { headers: headers() }
                );
                if (response.ok && !cancelled) setUsers(await response.json() as ChatUser[]);
            } catch { /* Mention suggestions remain optional. */ }
        };
        void read();
        return () => { cancelled = true; };
    }, [requestID, open]);

    const activeToken = useMemo(() => {
        const match = text.match(/(?:^|\s)@([^@\n]*)$/);
        return match?.[1]?.toLowerCase().trim() ?? null;
    }, [text]);

    const suggestions = useMemo(() => activeToken === null
        ? []
        : users
            .filter(u => `${u.firstName} ${u.lastName} ${u.email}`
                .toLowerCase().includes(activeToken))
            .filter(u => !mentions.includes(u.userID))
            .slice(0, 6), [activeToken, users, mentions]);

    function insertMention(person: ChatUser) {
        const match = text.match(/(?:^|\s)@([^@\n]*)$/);
        if (!match) return;
        const start = text.length - match[0].length;
        const prefix = match[0].startsWith(" ") ? " " : "";
        setText(text.slice(0, start) + prefix + `@${person.firstName} ${person.lastName} `);
        setMentions(ids => [...new Set([...ids, person.userID])]);
    }

    async function send() {
        const message = text.trim();
        if (!message || busy) return;
        if (message.length > 4000) {
            setError(af ? "Maksimum 4000 karakters." : "Maximum 4000 characters.");
            return;
        }
        setBusy(true);
        setError("");
        try {
            const selected = mentions.filter(id => {
                const u = users.find(person => person.userID === id);
                return u && message.toLowerCase().includes(
                    `@${u.firstName} ${u.lastName}`.toLowerCase());
            });
            const response = await fetch(`${API_URL}/api/RequestComments`, {
                method: "POST",
                headers: headers(),
                body: JSON.stringify({
                    requestID, commentText: message, mentionedUserIDs: selected
                })
            });
            if (!response.ok) {
                const failure = await response.json().catch(() => ({})) as { message?: string };
                throw new Error(failure.message || `Unable to post message (HTTP ${response.status})`);
            }
            setText("");
            setMentions([]);
            await load();
        } catch (e) {
            setError(e instanceof Error ? e.message : (af ? "Kon nie stuur nie." : "Send failed."));
        } finally {
            setBusy(false);
        }
    }

    return (
        <section className="mt-4 rounded-2xl border border-white/15 bg-black/20 p-4 text-zinc-100">
            <button type="button" onClick={() => setOpen(v => !v)}
                aria-expanded={open}
                className="flex w-full items-center justify-between gap-3 text-left text-sm font-semibold text-zinc-100">
                <span>{af ? "IT-gesprek / Kommentaar" : "IT conversation / Comments"}
                    <span className="ml-2 text-xs font-normal text-zinc-400">({messages.length})</span>
                </span>
                <span aria-hidden="true">{open ? "−" : "+"}</span>
            </button>
            {open && (
                <div className="mt-4 space-y-3">
                    <div role="log" aria-live="polite" className="max-h-72 space-y-2 overflow-y-auto">
                        {loading && <p className="text-sm text-zinc-400">{af ? "Laai gesprek…" : "Loading conversation…"}</p>}
                        {!loading && messages.length === 0 && (
                            <p className="text-sm text-zinc-400">
                                {af ? "Nog geen boodskappe nie." : "No messages yet."}
                            </p>
                        )}
                        {messages.map(msg => (
                            <div key={msg.commentID} className="rounded-xl border border-white/10 bg-zinc-900/70 p-3">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <strong className="text-xs text-zinc-200">
                                        {msg.user
                                            ? `${msg.user.firstName} ${msg.user.lastName}`
                                            : `User #${msg.userID}`}
                                    </strong>
                                    <time className="text-xs text-zinc-500">
                                        {msg.createdDate ? new Date(msg.createdDate).toLocaleString(af ? "af-ZA" : "en-ZA") : ""}
                                    </time>
                                </div>
                                <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed">{msg.commentText}</p>
                            </div>
                        ))}
                    </div>
                    <div className="relative">
                        <label className="mb-2 block text-xs text-zinc-300" htmlFor={`it-chat-${requestID}`}>
                            {af ? "Skryf boodskap — gebruik @ om iemand te merk" : "Write a message — use @ to mention someone"}
                        </label>
                        <textarea
                            id={`it-chat-${requestID}`}
                            value={text}
                            onChange={event => setText(event.target.value)}
                            rows={3}
                            maxLength={4000}
                            placeholder={af ? "Tik @ om 'n gebruiker te kies…" : "Type @ to select a user…"}
                            className="w-full rounded-lg border border-white/20 bg-zinc-950 p-3 text-sm text-white placeholder:text-zinc-500"
                        />
                        {activeToken !== null && suggestions.length > 0 && (
                            <div className="relative z-10 mt-1 max-h-48 overflow-y-auto rounded-xl border border-amber-400/30 bg-zinc-900 shadow-lg">
                                {suggestions.map(person => (
                                    <button key={person.userID} type="button"
                                        onClick={() => insertMention(person)}
                                        className="block w-full border-b border-white/10 px-3 py-2 text-left text-sm hover:bg-white/10">
                                        <strong>@{person.firstName} {person.lastName}</strong>
                                        <span className="ml-2 text-xs text-zinc-400">{person.email}</span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                    {mentions.length > 0 && (
                        <p className="text-xs text-amber-200">
                            {af ? "Gemerk vir portaalboodskap:" : "Portal notifications for:"}{" "}
                            {users.filter(u => mentions.includes(u.userID)).map(u => u.firstName + " " + u.lastName).join(", ")}
                        </p>
                    )}
                    {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
                    <button type="button" disabled={busy || !text.trim()} onClick={() => void send()}
                        className="rounded-xl border border-amber-400/50 bg-amber-400/15 px-4 py-2.5 text-sm font-semibold text-amber-100 disabled:opacity-50">
                        {busy ? (af ? "Stuur…" : "Sending…") : (af ? "Stuur boodskap" : "Send message")}
                    </button>
                </div>
            )}
        </section>
    );
}
