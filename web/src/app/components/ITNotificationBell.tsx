"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useLanguage } from "../language";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

interface Notice {
    notificationID: number;
    requestID: number;
    commentID: number;
    createdAt: string;
    readAt: string | null;
    authorName: string;
    requestTitle: string;
    commentText: string;
}

export default function ITNotificationBell({ roleID }: { roleID: number }) {
    const router = useRouter();
    const { language } = useLanguage();
    const af = language === "af";
    const [items, setItems] = useState<Notice[]>([]);
    const [unread, setUnread] = useState(0);
    const [open, setOpen] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        let cancelled = false;
        async function refresh() {
            const token = localStorage.getItem("token");
            if (!token) return;
            try {
                const res = await fetch(`${API_URL}/api/ITNotifications`, {
                    headers: { Authorization: `Bearer ${token}` },
                    cache: "no-store"
                });
                if (!res.ok) throw new Error("Notifications HTTP " + res.status);
                const data = await res.json() as {
                    unreadCount: number; notifications: Notice[];
                };
                if (!cancelled) {
                    setItems(data.notifications);
                    setUnread(data.unreadCount);
                    setError("");
                }
            } catch {
                // Keep the main portal usable if notifications need attention.
                if (!cancelled) setError(af ? "Kennisgewings onbeskikbaar." : "Notifications unavailable.");
            }
        }
        void refresh();
        const refreshTimer = window.setInterval(() => {
            if (document.visibilityState === "visible") void refresh();
        }, 20000);
        return () => { cancelled = true; window.clearInterval(refreshTimer); };
    }, [af]);

    async function openNotice(notice: Notice) {
        const token = localStorage.getItem("token");
        if (!token) return;
        try {
            const response = await fetch(
                `${API_URL}/api/ITNotifications/${notice.notificationID}/read`,
                { method: "POST", headers: { Authorization: `Bearer ${token}` } }
            );
            if (!response.ok) throw new Error("Unable to mark notification as read.");
            setItems(current => current.map(item => item.notificationID === notice.notificationID
                ? { ...item, readAt: new Date().toISOString() }
                : item));
            if (!notice.readAt) setUnread(n => Math.max(0, n - 1));
            setOpen(false);
            router.push(roleID === 2
                ? `/Tech?requestId=${notice.requestID}`
                : roleID === 3
                    ? `/Admin?requestId=${notice.requestID}`
                    : `/requests?requestId=${notice.requestID}`);
        } catch {
            setError(af ? "Kon nie kennisgewing oopmaak nie." : "Couldn't open notification.");
        }
    }

    return (
        <div className="relative">
            <button type="button"
                onClick={() => setOpen(o => !o)}
                aria-expanded={open}
                aria-label={af ? `Kennisgewings: ${unread} ongelees` : `Notifications: ${unread} unread`}
                title={af ? "IT-kennisgewings" : "IT notifications"}
                className="relative rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-zinc-100 hover:bg-white/10">
                <span aria-hidden="true">🔔</span>
                {unread > 0 && (
                    <span className="ml-1 rounded-full bg-amber-400 px-1.5 text-xs font-bold text-black">
                        {unread > 99 ? "99+" : unread}
                    </span>
                )}
            </button>
            {open && (
                <div className="absolute right-0 top-full z-50 mt-2 w-[min(340px,85vw)] rounded-2xl border border-white/20 bg-zinc-950 p-3 text-zinc-100 shadow-2xl">
                    <div className="mb-2 text-sm font-semibold">
                        {af ? "IT-boodskappe en vermeldings" : "IT messages and mentions"}
                    </div>
                    {error && <p role="status" className="mb-2 text-xs text-amber-300">{error}</p>}
                    {items.length === 0 && (
                        <p className="p-3 text-sm text-zinc-400">
                            {af ? "Geen kennisgewings nie." : "No notifications yet."}
                        </p>
                    )}
                    <div className="max-h-80 space-y-1 overflow-y-auto">
                        {items.map(item => (
                            <button key={item.notificationID} type="button"
                                onClick={() => void openNotice(item)}
                                className={`w-full rounded-xl px-3 py-3 text-left hover:bg-white/10 ${item.readAt ? "text-zinc-400" : "bg-amber-400/10 text-zinc-100"}`}>
                                <span className="block text-xs font-semibold">
                                    {item.authorName} · #{item.requestID}
                                    {!item.readAt && <span className="ml-2 text-amber-200">●</span>}
                                </span>
                                <span className="mt-1 block truncate text-xs">{item.requestTitle}</span>
                                <span className="mt-1 block line-clamp-2 text-xs">{item.commentText}</span>
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
