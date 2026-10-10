"use client";

import { displayLabel, requestStage } from "./labels";

import LogisticsRequestDiscussion from "./LogisticsRequestDiscussion";
import { useLanguage } from "../language";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

interface LogisticsDepartment {
    departmentID: number;
    departmentName: string;
    isActive?: boolean;
}

interface LogisticsWorker {
    workerID: number;
    firstName: string;
    lastName: string;
    workerType: string | null;
    isActive: boolean;
}

interface LogisticsRequest {
    requestID: number;
    requestedByUserID: number;
    requestedByName: string;
    requestedByEmail: string;
    requestType: string;
    activityCategory: string | null;
    title: string;
    description: string | null;
    activityDate: string | null;
    startTime: string | null;
    endTime: string | null;
    cleanupNextDay: boolean | null;
    priority: string;
    status: string;
    managerNotes: string | null;
    reviewedByUserID: number | null;
    reviewedDate: string | null;
    convertedTaskID: number | null;
    createdDate: string;
    updatedDate: string;
    locations: Array<{
        requestLocationID: number;
        locationID: number | null;
        locationName: string | null;
        locationText: string | null;
        isPrimary: boolean;
    }>;
    equipment: Array<{
        requestEquipmentID: number;
        equipmentTypeID: number;
        equipmentName: string;
        quantity: number | null;
        notes: string | null;
    }>;
    maintenanceItems: Array<{
        requestMaintenanceItemID: number;
        maintenanceTypeID: number;
        maintenanceName: string;
        actionType: string;
        notes: string | null;
    }>;
}

interface LogisticsRequestInboxProps {
    isAdmin: boolean;
    departments: LogisticsDepartment[];
    workers: LogisticsWorker[];
    onTaskConverted: () => void;
    tasks: Array<{ taskID: number; responsibleWorkerName?: string | null; responsibleUserName?: string | null; responsibleText: string | null; nextAction: string | null }>;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL;

const inputClass =
    "nkrn-input w-full rounded-xl border border-white/10 bg-zinc-900/70 px-3.5 py-3 text-sm text-white placeholder:text-zinc-600 outline-none transition focus:border-white/25 focus:bg-zinc-900";

const selectClass =
    "nkrn-select w-full rounded-xl border border-white/10 bg-zinc-900/70 px-3.5 py-3 text-sm text-white outline-none transition focus:border-white/25 focus:bg-zinc-900";

const secondaryButton =
    "rounded-xl border border-white/10 bg-white/6 px-4 py-2.5 text-sm font-medium text-zinc-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-45";

function authHeaders(): HeadersInit {
    const token = localStorage.getItem("token");

    return {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
}

function displayDate(value?: string | null) {
    if (!value) return "—";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return value;
    }

    return date.toLocaleDateString((typeof document !== "undefined" && document.documentElement.lang === "en" ? "en-ZA" : "af-ZA"), {
        day: "2-digit",
        month: "short",
        year: "numeric",
    });
}

function displayDateTime(value?: string | null) {
    if (!value) return "—";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return value;
    }

    return date.toLocaleString((typeof document !== "undefined" && document.documentElement.lang === "en" ? "en-ZA" : "af-ZA"), {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

function shortTime(value?: string | null) {
    if (!value) return "—";
    return value.slice(0, 5);
}

function primaryLocation(request: LogisticsRequest) {
    const primary =
        request.locations?.find((location) => location.isPrimary) ??
        request.locations?.[0];

    return (
        primary?.locationName ||
        primary?.locationText ||
        "No location supplied"
    );
}

function workerName(worker: LogisticsWorker) {
    const name =
        `${worker.firstName ?? ""} ${worker.lastName ?? ""}`.trim();

    return name || `Worker #${worker.workerID}`;
}

function requestStatusClass(status: string) {
    const value = requestStage(status).toLowerCase();

    if (value === "logged") {
        return "border-yellow-400/20 bg-yellow-500/10 text-yellow-200";
    }

    if (value === "busy") {
        return "border-orange-400/20 bg-orange-500/10 text-orange-200";
    }

    if (value === "approved") {
        return "border-blue-400/20 bg-blue-500/10 text-blue-200";
    }

    if (value === "done") {
        return "border-green-400/20 bg-green-500/10 text-green-200";
    }

    if (value === "declined" || value === "cancelled") {
        return "border-red-400/20 bg-red-500/10 text-red-200";
    }

    return "border-white/10 bg-white/5 text-zinc-300";
}

function isOpenRequest(request: LogisticsRequest) {
    return !["Completed", "Declined", "Cancelled"].includes(
        request.status
    );
}

export default function LogisticsRequestInbox({
    isAdmin,
    departments,
    workers,
    onTaskConverted,
    tasks,
}: LogisticsRequestInboxProps) {
    const router = useRouter();
    const { language, t } = useLanguage();
    const [deleting, setDeleting] = useState(false);
    const [bulkDeleting, setBulkDeleting] = useState(false);
    const [selectedRequestIDs, setSelectedRequestIDs] = useState<number[]>([]);
    const [createdFrom, setCreatedFrom] = useState("");
    const [createdTo, setCreatedTo] = useState("");
    const [requests, setRequests] = useState<LogisticsRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [search, setSearch] = useState("");
    const [typeFilter, setTypeFilter] = useState("");
    const [priorityFilter, setPriorityFilter] = useState("");
    const [filter, setFilter] = useState("Open");
    const [selectedRequest, setSelectedRequest] =
        useState<LogisticsRequest | null>(null);

    const [reviewStatus, setReviewStatus] = useState("Under Review");
    const [managerNotes, setManagerNotes] = useState("");
    const [departmentID, setDepartmentID] = useState("");
    const [workerID, setWorkerID] = useState("");
    const [priority, setPriority] = useState("Medium");
    const [dueDate, setDueDate] = useState("");
    const [nextAction, setNextAction] = useState("");
    const [includeOnJobCard, setIncludeOnJobCard] = useState(true);

    const [savingReview, setSavingReview] = useState(false);
    const [converting, setConverting] = useState(false);

    const loadRequests = useCallback(async () => {
        try {
            setLoading(true);
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

            if (response.status === 403) {
                throw new Error(
                    "Jou rekening het nie toegang om Logistieke versoeke te bestuur nie."
                );
            }

            if (!response.ok) {
                throw new Error(
                    `Unable to load Logistics requests (${response.status}).`
                );
            }

            const loaded = (await response.json()) as LogisticsRequest[];
            setRequests(loaded);
            setSelectedRequest(current => current ? loaded.find(item => item.requestID === current.requestID) ?? null : null);
        } catch (loadError) {
            setError(
                loadError instanceof Error
                    ? loadError.message
                    : "Logistieke versoeke kon nie gelaai word nie."
            );
        } finally {
            setLoading(false);
        }
    }, [router]);

    useEffect(() => {
        const timer = window.setTimeout(() => {
            void loadRequests();
        }, 0);

        return () => window.clearTimeout(timer);
    }, [loadRequests]);

    const visibleRequests = useMemo(() => requests.filter(request => {
        const createdDate = request.createdDate?.slice(0, 10) ?? "";
        return (filter === "All" || (filter === "Open" ? isOpenRequest(request) : requestStage(request.status) === filter)) &&
            (!typeFilter || request.requestType === typeFilter) &&
            (!priorityFilter || request.priority === priorityFilter) &&
            (!createdFrom || createdDate >= createdFrom) &&
            (!createdTo || createdDate <= createdTo) &&
            `${request.title} ${request.description ?? ""} ${request.requestedByName} ${request.requestedByEmail} ${primaryLocation(request)} ${request.managerNotes ?? ""}`.toLowerCase().includes(search.toLowerCase());
    }), [requests, filter, typeFilter, priorityFilter, createdFrom, createdTo, search]);

    const newCount = requests.filter(
        (request) => request.status === "New"
    ).length;

    const openCount = requests.filter(isOpenRequest).length;

    function openRequest(request: LogisticsRequest) {
        setSelectedRequest(request);
        setReviewStatus(requestStage(request.status));
        setManagerNotes(request.managerNotes || "");
        setDepartmentID("");
        setWorkerID("");
        setPriority(request.priority || "Medium");
        setDueDate("");
        setNextAction(
            request.requestType === "Maintenance"
                ? "Assess and complete the requested maintenance."
                : "Review and complete the approved Logistics request."
        );
        setIncludeOnJobCard(true);
        setError("");
        setSuccess("");
    }

    function closeRequest() {
        if (savingReview || converting || deleting) {
            return;
        }

        setSelectedRequest(null);
    }

    async function deleteRequest() {
        if (!selectedRequest || !isAdmin || deleting) return;
        const confirmed = window.confirm(language === "af"
            ? `Verwyder versoek #${selectedRequest.requestID}? Dit verdwyn uit die versoeklyste. Bestaande werk bly behoue.`
            : `Delete request #${selectedRequest.requestID}? It will disappear from request lists. Existing work is retained.`);
        if (!confirmed) return;
        setDeleting(true);
        setError("");
        try {
            const response = await fetch(`${API_URL}/api/LogisticsRequests/${selectedRequest.requestID}`, { method: "DELETE", headers: authHeaders() });
            if (!response.ok) throw new Error(language === "af" ? "Die versoek kon nie verwyder word nie." : "Unable to delete the request.");
            setSelectedRequest(null);
            await loadRequests();
            setSuccess(language === "af" ? "Versoek verwyder." : "Request deleted.");
        } catch (error) { setError(error instanceof Error ? error.message : "Unable to delete the request."); }
        finally { setDeleting(false); }
    }

    function toggleRequestSelection(requestID: number) {
        setSelectedRequestIDs(current =>
            current.includes(requestID)
                ? current.filter(id => id !== requestID)
                : [...current, requestID]
        );
    }

    function toggleVisibleRequests() {
        const visibleIDs = visibleRequests.map(request => request.requestID);
        const allVisibleSelected = visibleIDs.length > 0 &&
            visibleIDs.every(id => selectedRequestIDs.includes(id));

        setSelectedRequestIDs(current => allVisibleSelected
            ? current.filter(id => !visibleIDs.includes(id))
            : Array.from(new Set([...current, ...visibleIDs])));
    }

    async function deleteSelectedRequests() {
        if (!isAdmin || bulkDeleting || selectedRequestIDs.length === 0) return;

        const selected = requests.filter(request => selectedRequestIDs.includes(request.requestID));
        const preview = selected.slice(0, 8).map(request => `#${request.requestID} — ${request.title}`).join("\\n");
        const remaining = selected.length > 8 ? `\\n…and ${selected.length - 8} more.` : "";
        const confirmed = window.confirm(language === "af"
            ? `Verwyder ${selectedRequestIDs.length} geselekteerde versoek(e)? Die versoeke sal uit die lyste verdwyn; gekoppelde werk/take word behou.\\n\\n${preview}${remaining}`
            : `Delete ${selectedRequestIDs.length} selected request(s)? The requests will disappear from lists; linked work/tasks will be retained.\\n\\n${preview}${remaining}`);
        if (!confirmed) return;

        setBulkDeleting(true);
        setError("");
        setSuccess("");
        try {
            const response = await fetch(`${API_URL}/api/LogisticsRequests/bulk-delete`, {
                method: "POST",
                headers: authHeaders(),
                body: JSON.stringify(selectedRequestIDs),
            });
            if (!response.ok) {
                const details = await response.json().catch(() => null);
                throw new Error(details?.message || (language === "af"
                    ? "Die geselekteerde versoeke kon nie verwyder word nie."
                    : "Unable to delete the selected requests."));
            }

            const result = await response.json() as { deletedCount: number; notFoundRequestIDs: number[] };
            setSelectedRequestIDs([]);
            if (selectedRequest && selectedRequestIDs.includes(selectedRequest.requestID)) {
                setSelectedRequest(null);
            }
            await loadRequests();
            const skipped = result.notFoundRequestIDs?.length ?? 0;
            setSuccess(language === "af"
                ? `${result.deletedCount} versoek(e) verwyder.${skipped ? ` ${skipped} was reeds verwyder of nie gevind nie.` : ""}`
                : `${result.deletedCount} request(s) deleted.${skipped ? ` ${skipped} were already deleted or not found.` : ""}`);
        } catch (error) {
            setError(error instanceof Error ? error.message : "Unable to delete the selected requests.");
        } finally {
            setBulkDeleting(false);
        }
    }

    async function saveReview() {
        if (!selectedRequest) {
            return;
        }

        try {
            setSavingReview(true);
            setError("");
            setSuccess("");

            const response = await fetch(
                `${API_URL}/api/LogisticsRequests/${selectedRequest.requestID}/status`,
                {
                    method: "PUT",
                    headers: authHeaders(),
                    body: JSON.stringify({
                        status: reviewStatus,
                        managerNotes: managerNotes.trim() || null,
                    priority,
                    }),
                }
            );

            if (!response.ok) {
                let message = "Die versoek kon nie opgedateer word nie.";

                try {
                    const body = (await response.json()) as {
                        message?: string;
                        title?: string;
                    };
                    message = body.message || body.title || message;
                } catch {
                    // Keep fallback.
                }

                throw new Error(message);
            }

            setSuccess(
                language === "af" ? `Versoek #${selectedRequest.requestID}: ${t(displayLabel(requestStage(reviewStatus)))}.` : `Request #${selectedRequest.requestID}: ${requestStage(reviewStatus)}.`
            );

            setSelectedRequest(null);
            await loadRequests();
        } catch (reviewError) {
            setError(
                reviewError instanceof Error
                    ? reviewError.message
                    : "Die versoek kon nie opgedateer word nie."
            );
        } finally {
            setSavingReview(false);
        }
    }

    async function convertToTask() {
        if (!selectedRequest) {
            return;
        }

        const confirmed = window.confirm(
            language === "af" ? `Ken werk toe vir versoek #${selectedRequest.requestID}?` : `Assign work for request #${selectedRequest.requestID}?`
        );

        if (!confirmed) {
            return;
        }

        try {
            setConverting(true);
            setError("");
            setSuccess("");

            const response = await fetch(
                `${API_URL}/api/LogisticsRequests/${selectedRequest.requestID}/convert`,
                {
                    method: "POST",
                    headers: authHeaders(),
                    body: JSON.stringify({
                        departmentID: departmentID
                            ? Number(departmentID)
                            : null,
                        responsibleWorkerID: workerID
                            ? Number(workerID)
                            : null,
                        priority,
                        dueDate: dueDate || null,
                        nextAction: nextAction.trim() || null,
                        managerNotes: managerNotes.trim() || null,
                        includeOnJobCard,
                    }),
                }
            );

            if (!response.ok) {
                let message = "Die versoek kon nie aan ’n taak gekoppel word nie.";

                try {
                    const body = (await response.json()) as {
                        message?: string;
                        title?: string;
                    };
                    message = body.message || body.title || message;
                } catch {
                    // Keep fallback.
                }

                throw new Error(message);
            }

            const body = (await response.json()) as {
                taskID: number;
            };

            setSuccess(
                `Request #${selectedRequest.requestID} was converted to Task #${body.taskID}.`
            );

            setSelectedRequest(null);
            await loadRequests();
            onTaskConverted();
        } catch (convertError) {
            setError(
                convertError instanceof Error
                    ? convertError.message
                    : "Die versoek kon nie aan ’n taak gekoppel word nie."
            );
        } finally {
            setConverting(false);
        }
    }

    return (
        <>
            <section id="versoeke" className="nkrn-panel mb-8 overflow-hidden rounded-[28px] border border-white/10 bg-white/4 shadow-2xl shadow-black/20 backdrop-blur-2xl">
                <div className="border-b border-white/8 p-5 sm:p-6">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                            <p className="text-xs font-medium uppercase tracking-[0.22em] text-yellow-400">
                                Personeelversoeke
                            </p>
                            <div className="mt-1 flex flex-wrap items-center gap-3">
                                <h2 className="text-xl font-semibold">
                                    Versoekinkassie
                                </h2>
                                {newCount > 0 && (
                                    <span className="rounded-full border border-yellow-400/20 bg-yellow-500/10 px-2.5 py-1 text-xs font-semibold text-yellow-200">
                                        {newCount} nuut
                                    </span>
                                )}
                            </div>
                            <p className="mt-1 text-sm text-zinc-500">
                                Hersien personeelversoeke, ken verantwoordelikheid toe en beplan die volgende aksie.
                            </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-3">
                            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-zinc-400">
                                {openCount} oop
                            </span>

                            <input aria-label="Soek versoeke" placeholder="Soek naam, versoek of lokaal…" className={inputClass} value={search} onChange={e => setSearch(e.target.value)} />
                            <select aria-label="Soort versoek" className={selectClass} value={typeFilter} onChange={e => setTypeFilter(e.target.value)}><option value="">Alle soorte</option>{["Event", "Maintenance", "General", "Security"].map(value => <option key={value} value={value}>{displayLabel(value)}</option>)}</select>
                            <select aria-label="Prioriteit" className={selectClass} value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)}><option value="">Alle prioriteite</option>{["Low", "Medium", "High", "Critical"].map(value => <option key={value} value={value}>{displayLabel(value)}</option>)}</select>
                            <input aria-label="Vanaf datum" type="date" title={language === "af" ? "Ingedien vanaf" : "Submitted from"} className={inputClass} value={createdFrom} onChange={e => setCreatedFrom(e.target.value)} />
                            <input aria-label="Tot datum" type="date" title={language === "af" ? "Ingedien tot" : "Submitted to"} className={inputClass} value={createdTo} onChange={e => setCreatedTo(e.target.value)} />
                            <select
                                aria-label="Versoekstatus"
                                value={filter}
                                onChange={(event) => setFilter(event.target.value)}
                                className="nkrn-select rounded-xl border border-white/10 bg-zinc-900/70 px-3.5 py-2.5 text-sm text-white outline-none"
                            >
                                <option value="Open">Oop versoeke</option>
                                <option value="Logged">Logged</option>
                                <option value="Busy">Busy</option>
                                <option value="Done">Done</option>
                                <option value="Declined">Afgekeur</option>
                                <option value="Cancelled">Gekanselleer</option>
                                <option value="All">Alle versoeke</option>
                            </select>

                            {isAdmin && selectedRequestIDs.length > 0 && (
                                <div className="flex flex-wrap items-center gap-2 rounded-xl border border-red-400/20 bg-red-500/8 p-2">
                                    <span className="px-2 text-xs text-red-100">
                                        {selectedRequestIDs.length} {language === "af" ? "geselekteer" : "selected"}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => void deleteSelectedRequests()}
                                        disabled={bulkDeleting || deleting}
                                        className="rounded-lg border border-red-400/30 bg-red-500/15 px-3 py-2 text-sm font-semibold text-red-100 transition hover:bg-red-500/25 disabled:opacity-50"
                                    >
                                        {bulkDeleting
                                            ? (language === "af" ? "Verwyder…" : "Deleting…")
                                            : (language === "af" ? "Verwyder gekose" : "Delete selected")}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setSelectedRequestIDs([])}
                                        disabled={bulkDeleting}
                                        className={secondaryButton}
                                    >
                                        {language === "af" ? "Maak keuse skoon" : "Clear selection"}
                                    </button>
                                </div>
                            )}
                            <button
                                type="button"
                                onClick={() => void loadRequests()}
                                className={secondaryButton}
                            >
                                Verfris versoeke
                            </button>
                        </div>
                    </div>
                </div>

                {error && (
                    <div className="border-b border-red-400/10 bg-red-500/7 px-5 py-4 text-sm text-red-300">
                        {error}
                    </div>
                )}

                {success && (
                    <div className="border-b border-green-400/10 bg-green-500/7 px-5 py-4 text-sm text-green-300">
                        {success}
                    </div>
                )}

                {loading ? (
                    <div className="p-6 text-sm text-zinc-500">
                        Logistics-versoeke laai…
                    </div>
                ) : visibleRequests.length === 0 ? (
                    <div className="p-5 sm:p-6">
                        <div className="rounded-2xl border border-dashed border-white/10 bg-black/10 p-6 text-sm text-zinc-500">
                            Geen versoeke pas by die filter nie.
                        </div>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-left text-sm">
                            <thead className="border-b border-white/8 bg-black/15 text-xs uppercase tracking-[0.12em] text-zinc-500">
                                <tr>
                                    {isAdmin && (
                                        <th className="px-4 py-4 font-medium">
                                            <input
                                                type="checkbox"
                                                aria-label={language === "af" ? "Kies alle sigbare versoeke" : "Select all visible requests"}
                                                checked={visibleRequests.length > 0 && visibleRequests.every(request => selectedRequestIDs.includes(request.requestID))}
                                                onChange={toggleVisibleRequests}
                                                className="h-4 w-4 accent-red-500"
                                            />
                                        </th>
                                    )}
                                    <th className="px-5 py-4 font-medium">Versoek</th>
                                    <th className="px-5 py-4 font-medium">Ingedien deur</th>
                                    <th className="px-5 py-4 font-medium">Soort</th>
                                    <th className="px-5 py-4 font-medium">Lokaal / Ligging</th>
                                    <th className="px-5 py-4 font-medium">Ingedien</th>
                                    <th className="px-5 py-4 font-medium">Status</th>
                                    <th className="px-5 py-4 text-right font-medium">Aksie</th>
                                </tr>
                            </thead>

                            <tbody className="divide-y divide-white/6">
                                {visibleRequests.map((request) => (
                                    <tr
                                        key={request.requestID}
                                        className="transition hover:bg-white/2.5"
                                    >
                                        {isAdmin && (
                                            <td className="px-4 py-4 align-top">
                                                <input
                                                    type="checkbox"
                                                    aria-label={language === "af" ? `Kies versoek ${request.requestID}` : `Select request ${request.requestID}`}
                                                    checked={selectedRequestIDs.includes(request.requestID)}
                                                    onChange={() => toggleRequestSelection(request.requestID)}
                                                    className="h-4 w-4 accent-red-500"
                                                />
                                            </td>
                                        )}
                                        <td className="min-w-72 px-5 py-4">
                                            <p className="font-medium text-zinc-100">
                                                {request.title}
                                            </p>
                                            <p className="mt-2 whitespace-pre-wrap text-zinc-300">{request.description || "Geen beskrywing"}</p>
                                            <p className="mt-2 text-xs text-[#e7b42b]">{displayLabel(request.priority)} · {displayDate(request.activityDate)} {shortTime(request.startTime)} – {shortTime(request.endTime)}</p>
                                            <p className="mt-2 text-xs text-zinc-300">Toerusting: {request.equipment.map(item => `${item.equipmentName}${item.quantity ? ` × ${item.quantity}` : ""}${item.notes ? ` (${item.notes})` : ""}`).join(", ") || "Geen"}</p>
                                            <p className="mt-1 text-xs text-zinc-300">{request.maintenanceItems.map(item => `${item.maintenanceName}: ${displayLabel(item.actionType)} ${item.notes || ""}`).join("; ")}</p>
                                            <p className="mt-2 text-xs text-zinc-300">Bestuurdersnota: {request.managerNotes || "Nog geen nota"}</p>
                                            <p className="mt-1 text-xs text-zinc-300">Verantwoordelik: {(() => { const task = tasks.find(task => task.taskID === request.convertedTaskID); return task?.responsibleWorkerName || task?.responsibleUserName || task?.responsibleText || "Unassigned"; })()}</p>
                                            <p className="mt-1 text-xs text-zinc-300">Volgende aksie: {tasks.find(task => task.taskID === request.convertedTaskID)?.nextAction || (isOpenRequest(request) ? "Hersien en ken verantwoordelikheid toe" : displayLabel(request.status))}</p>
                                            <p className="mt-1 font-mono text-xs text-zinc-600">
                                                Request #{request.requestID}
                                                {request.convertedTaskID
                                                    ? ` · Task #${request.convertedTaskID}`
                                                    : ""}
                                            </p>
                                        </td>

                                        <td className="min-w-48 px-5 py-4 text-zinc-300">
                                            <div>{request.requestedByName || "Unknown"}</div>
                                            <div className="mt-1 text-xs text-zinc-600">
                                                {request.requestedByEmail}
                                            </div>
                                        </td>

                                        <td className="px-5 py-4 text-zinc-400">
                                            {displayLabel(request.requestType)}
                                        </td>

                                        <td className="min-w-44 px-5 py-4 text-zinc-400">
                                            {primaryLocation(request)}
                                        </td>

                                        <td className="min-w-40 px-5 py-4 text-zinc-400">
                                            {displayDateTime(request.createdDate)}
                                        </td>

                                        <td className="px-5 py-4">
                                            <span
                                                className={`whitespace-nowrap rounded-full border px-2.5 py-1 text-xs ${requestStatusClass(
                                                    request.status
                                                )}`}
                                            >
                                                {displayLabel(request.status)}
                                            </span>
                                        </td>

                                        <td className="px-5 py-4 text-right">
                                            <button
                                                type="button"
                                                onClick={() => openRequest(request)}
                                                className={secondaryButton}
                                            >
                                                Hersien
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>

            {selectedRequest && (
                <div
                    className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/75 px-4 py-6 backdrop-blur-sm"
                    onMouseDown={(event) => {
                        if (event.currentTarget === event.target) {
                            closeRequest();
                        }
                    }}
                >
                    <div className="nkrn-panel my-auto w-full max-w-5xl rounded-[28px] border border-white/10 bg-zinc-950/95 p-5 shadow-2xl shadow-black/40 backdrop-blur-2xl sm:p-7">
                        <div className="flex flex-col gap-5 border-b border-white/8 pb-5 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                                <p className="text-xs font-medium uppercase tracking-[0.22em] text-yellow-400">
                                    Logistieke versoek #{selectedRequest.requestID}
                                </p>
                                <h2 className="mt-1 text-2xl font-semibold">
                                    {selectedRequest.title}
                                </h2>
                                <p className="mt-2 text-sm text-zinc-500">
                                    Ingedien deur {selectedRequest.requestedByName} ·{" "}
                                    {displayDateTime(selectedRequest.createdDate)}
                                </p>
                            </div>

                            <button
                                type="button"
                                onClick={closeRequest}
                                disabled={savingReview || converting || deleting}
                                className={secondaryButton}
                            >
                                Sluit
                            </button>
                        </div>

                        <div className="mt-6 grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
                            <div className="space-y-5">
                                <LogisticsRequestDiscussion key={selectedRequest.requestID} requestID={selectedRequest.requestID} canEdit onSaved={() => { void loadRequests(); }} />
                                <div className="rounded-2xl border border-white/8 bg-black/15 p-5">
                                    <div className="grid gap-4 sm:grid-cols-2">
                                        <Info
                                            label="Soort versoek"
                                            value={displayLabel(selectedRequest.requestType)}
                                        />
                                        <Info
                                            label="Lokaal / Ligging"
                                            value={primaryLocation(selectedRequest)}
                                        />
                                        <Info
                                            label="Aktiwiteitskategorie"
                                            value={selectedRequest.activityCategory || "—"}
                                        />
                                        <Info
                                            label="Datum"
                                            value={displayDate(selectedRequest.activityDate)}
                                        />
                                        <Info
                                            label="Tyd"
                                            value={
                                                selectedRequest.startTime || selectedRequest.endTime
                                                    ? `${shortTime(selectedRequest.startTime)}–${shortTime(
                                                          selectedRequest.endTime
                                                      )}`
                                                    : "—"
                                            }
                                        />
                                        <Info
                                            label="Huidige status"
                                            value={displayLabel(selectedRequest.status)}
                                        />
                                    </div>

                                    <div className="mt-5">
                                        <p className="text-[11px] uppercase tracking-[0.14em] text-zinc-600">
                                            Beskrywing
                                        </p>
                                        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-zinc-300">
                                            {selectedRequest.description || "Geen beskrywing verskaf nie."}
                                        </p>
                                    </div>
                                </div>

                                {selectedRequest.maintenanceItems.length > 0 && (
                                    <div className="rounded-2xl border border-white/8 bg-black/15 p-5">
                                        <p className="text-[11px] uppercase tracking-[0.14em] text-zinc-600">
                                            Instandhouding
                                        </p>
                                        <div className="mt-3 space-y-2">
                                            {selectedRequest.maintenanceItems.map((item) => (
                                                <div
                                                    key={item.requestMaintenanceItemID}
                                                    className="rounded-xl border border-white/8 bg-white/2.5 px-4 py-3 text-sm text-zinc-300"
                                                >
                                                    {item.maintenanceName} · {displayLabel(item.actionType)}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {selectedRequest.equipment.length > 0 && (
                                    <div className="rounded-2xl border border-white/8 bg-black/15 p-5">
                                        <p className="text-[11px] uppercase tracking-[0.14em] text-zinc-600">
                                            Toerusting
                                        </p>
                                        <div className="mt-3 flex flex-wrap gap-2">
                                            {selectedRequest.equipment.map((item) => (
                                                <span
                                                    key={item.requestEquipmentID}
                                                    className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-zinc-300"
                                                >
                                                    {item.equipmentName}
                                                    {item.quantity ? ` × ${item.quantity}` : ""}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="space-y-5">
                                <div className="rounded-2xl border border-white/8 bg-black/15 p-5">
                                    <p className="text-xs font-medium uppercase tracking-[0.18em] text-yellow-400">
                                        Hersien
                                    </p>

                                    <label className="mt-4 block">
                                        <span className="mb-2 block text-xs uppercase tracking-[0.12em] text-zinc-500">
                                            Versoekstatus
                                        </span>
                                        <select
                                            value={reviewStatus}
                                            onChange={(event) =>
                                                setReviewStatus(event.target.value)
                                            }
                                            className={selectClass}
                                        >
                                            <option value="Logged">Aangemeld</option>
                                            <option value="Busy">Besig</option>
                                            <option value="Done">Afgehandel</option>
                                        </select>
                                    </label>

                                    <label className="mt-4 block">{t("Priority")}
                                        <select className={selectClass} value={priority} onChange={event => setPriority(event.target.value)}>
                                            {["Low", "Medium", "High", "Critical"].map(value => <option key={value} value={value}>{displayLabel(value)}</option>)}
                                        </select>
                                    </label>
                                    <label className="mt-4 block">
                                        <span className="mb-2 block text-xs uppercase tracking-[0.12em] text-zinc-500">
                                            Bestuurdersnotas
                                        </span>
                                        <textarea
                                            value={managerNotes}
                                            onChange={(event) =>
                                                setManagerNotes(event.target.value)
                                            }
                                            rows={4}
                                            placeholder="Voeg ’n kort nota by indien nodig"
                                            className={`${inputClass} resize-y`}
                                        />
                                    </label>

                                    {isAdmin && <button type="button" onClick={() => void deleteRequest()} disabled={deleting || savingReview || converting}
                                        className="mt-4 w-full rounded-xl border border-red-400/30 px-4 py-3 text-red-300">
                                        {language === "af" ? (deleting ? "Verwyder…" : "Verwyder versoek") : (deleting ? "Deleting…" : "Delete request")}
                                    </button>}
                                    <button
                                        type="button"
                                        onClick={() => void saveReview()}
                                        disabled={savingReview || converting || deleting}
                                        className="mt-4 w-full rounded-xl border border-white/10 bg-white/7 px-4 py-3 text-sm font-semibold text-zinc-100 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-45"
                                    >
                                        {savingReview ? "Saving…" : "Save Review"}
                                    </button>
                                </div>

                                {isOpenRequest(selectedRequest) && !selectedRequest.convertedTaskID && (
                                    <div className="rounded-2xl border border-yellow-400/15 bg-yellow-500/5 p-5">
                                        <p className="text-xs font-medium uppercase tracking-[0.18em] text-yellow-400">
                                            Opsionele werktoewysing
                                        </p>
                                        <p className="mt-2 text-xs leading-5 text-zinc-500">
                                            Gebruik dit wanneer die versoek op ’n werkkaart moet verskyn. Jy kan die versoek ook direk hier afhandel.
                                        </p>

                                        <div className="mt-4 grid gap-4 sm:grid-cols-2">
                                            <label className="block">
                                                <span className="mb-2 block text-xs uppercase tracking-[0.12em] text-zinc-500">
                                                    Afdeling
                                                </span>
                                                <select
                                                    value={departmentID}
                                                    onChange={(event) =>
                                                        setDepartmentID(event.target.value)
                                                    }
                                                    className={selectClass}
                                                >
                                                    <option value="">Nie toegeken nie</option>
                                                    {departments
                                                        .filter(
                                                            (department) =>
                                                                department.isActive !== false
                                                        )
                                                        .map((department) => (
                                                            <option
                                                                key={department.departmentID}
                                                                value={String(
                                                                    department.departmentID
                                                                )}
                                                            >
                                                                {department.departmentName}
                                                            </option>
                                                        ))}
                                                </select>
                                            </label>

                                            <label className="block">
                                                <span className="mb-2 block text-xs uppercase tracking-[0.12em] text-zinc-500">
                                                    Werker
                                                </span>
                                                <select
                                                    value={workerID}
                                                    onChange={(event) =>
                                                        setWorkerID(event.target.value)
                                                    }
                                                    className={selectClass}
                                                >
                                                    <option value="">Nie toegeken nie</option>
                                                    {workers
                                                        .filter(
                                                            (worker) => worker.isActive !== false
                                                        )
                                                        .map((worker) => (
                                                            <option
                                                                key={worker.workerID}
                                                                value={String(worker.workerID)}
                                                            >
                                                                {workerName(worker)}
                                                                {worker.workerType
                                                                    ? ` · ${worker.workerType}`
                                                                    : ""}
                                                            </option>
                                                        ))}
                                                </select>
                                            </label>



                                            <label className="block">
                                                <span className="mb-2 block text-xs uppercase tracking-[0.12em] text-zinc-500">
                                                    Sperdatum
                                                </span>
                                                <input
                                                    type="date"
                                                    value={dueDate}
                                                    onChange={(event) =>
                                                        setDueDate(event.target.value)
                                                    }
                                                    className={inputClass}
                                                />
                                            </label>
                                        </div>

                                        <label className="mt-4 block">
                                            <span className="mb-2 block text-xs uppercase tracking-[0.12em] text-zinc-500">
                                                Volgende aksie
                                            </span>
                                            <textarea
                                                value={nextAction}
                                                onChange={(event) =>
                                                    setNextAction(event.target.value)
                                                }
                                                rows={3}
                                                className={`${inputClass} resize-y`}
                                            />
                                        </label>

                                        <label className="mt-4 flex items-center gap-3 rounded-xl border border-white/8 bg-black/15 p-3">
                                            <input
                                                type="checkbox"
                                                checked={includeOnJobCard}
                                                onChange={(event) =>
                                                    setIncludeOnJobCard(
                                                        event.target.checked
                                                    )
                                                }
                                                className="h-4 w-4 rounded border-white/20 bg-zinc-900"
                                            />
                                            <span className="text-sm text-zinc-300">
                                                Sluit die taak by werkkaarte in
                                            </span>
                                        </label>

                                        <button
                                            type="button"
                                            onClick={() => void convertToTask()}
                                            disabled={converting || savingReview || deleting}
                                            className="mt-5 w-full rounded-xl border border-yellow-300/20 bg-yellow-400 px-4 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-yellow-300 disabled:cursor-not-allowed disabled:opacity-50"
                                        >
                                            {converting
                                                ? "Converting…"
                                                : "Assign work"}
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

function Info({
    label,
    value,
}: {
    label: string;
    value: string;
}) {
    return (
        <div className="rounded-xl border border-white/8 bg-white/2.5 p-3">
            <p className="text-[11px] uppercase tracking-[0.14em] text-zinc-600">
                {label}
            </p>
            <p className="mt-1 text-sm text-zinc-300">{value}</p>
        </div>
    );
}
