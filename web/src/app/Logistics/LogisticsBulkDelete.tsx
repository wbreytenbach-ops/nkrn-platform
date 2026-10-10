"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useLanguage } from "../language";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

type RequestRecord = {
    requestID: number;
    title: string;
    status: string;
    requestedByName?: string | null;
    requestedByEmail?: string | null;
    createdDate?: string | null;
};

type TaskRecord = {
    taskID: number;
    title: string;
    status: string;
    priority?: string | null;
    isArchived?: boolean;
};

type RecordRow = {
    key: string;
    kind: "request" | "task";
    id: number;
    title: string;
    status: string;
    detail: string;
};

const inputClass =
    "w-full rounded-xl border border-white/10 bg-zinc-900/70 px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-600 outline-none focus:border-white/25";
const buttonClass =
    "rounded-xl border border-white/10 bg-white/6 px-4 py-2.5 text-sm font-medium text-zinc-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-45";

export default function LogisticsBulkDelete({
    isAdmin,
    onDeleted,
}: {
    isAdmin: boolean;
    onDeleted: () => void;
}) {
    const router = useRouter();
    const { language } = useLanguage();
    const isAfrikaans = language === "af";

    const [requests, setRequests] = useState<RequestRecord[]>([]);
    const [tasks, setTasks] = useState<TaskRecord[]>([]);
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [search, setSearch] = useState("");
    const [typeFilter, setTypeFilter] = useState<"all" | "request" | "task">("all");
    const [loading, setLoading] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    const loadRecords = useCallback(async () => {
        setLoading(true);
        setError("");

        try {
            const token = localStorage.getItem("token");
            if (!token) {
                router.replace("/login");
                return;
            }

            const headers = { Authorization: `Bearer ${token}` };
            const [requestResponse, taskResponse] = await Promise.all([
                fetch(`${API_URL}/api/LogisticsRequests`, {
                    headers,
                    cache: "no-store",
                }),
                fetch(`${API_URL}/api/LogisticsTasks?includeArchived=true`, {
                    headers,
                    cache: "no-store",
                }),
            ]);

            if (requestResponse.status === 401 || taskResponse.status === 401) {
                localStorage.removeItem("token");
                localStorage.removeItem("user");
                router.replace("/login");
                return;
            }

            if (!requestResponse.ok || !taskResponse.ok) {
                throw new Error(
                    isAfrikaans
                        ? "Die versoeke en take kon nie gelaai word nie. Verfris en probeer weer."
                        : "Requests and tasks could not be loaded. Refresh and try again."
                );
            }

            const [requestData, taskData] = await Promise.all([
                requestResponse.json() as Promise<RequestRecord[]>,
                taskResponse.json() as Promise<TaskRecord[]>,
            ]);

            setRequests(requestData);
            setTasks(taskData);
        } catch (loadError) {
            setError(
                loadError instanceof Error
                    ? loadError.message
                    : isAfrikaans
                      ? "Kon nie die rekords laai nie."
                      : "Unable to load records."
            );
        } finally {
            setLoading(false);
        }
    }, [isAfrikaans, router]);

    useEffect(() => {
        void loadRecords();
    }, [loadRecords]);

    const rows = useMemo<RecordRow[]>(() => [
        ...requests.map((request) => ({
            key: `request:${request.requestID}`,
            kind: "request" as const,
            id: request.requestID,
            title: request.title,
            status: request.status,
            detail: [request.requestedByName, request.requestedByEmail].filter(Boolean).join(" · "),
        })),
        ...tasks.map((task) => ({
            key: `task:${task.taskID}`,
            kind: "task" as const,
            id: task.taskID,
            title: task.title,
            status: task.isArchived ? (isAfrikaans ? "Geargiveer" : "Archived") : task.status,
            detail: task.priority ? `${isAfrikaans ? "Prioriteit" : "Priority"}: ${task.priority}` : "",
        })),
    ], [requests, tasks, isAfrikaans]);

    const visibleRows = useMemo(() => {
        const term = search.trim().toLocaleLowerCase();
        return rows.filter((row) =>
            (typeFilter === "all" || row.kind === typeFilter) &&
            (!term || `${row.id} ${row.title} ${row.status} ${row.detail} ${row.kind}`.toLocaleLowerCase().includes(term))
        );
    }, [rows, search, typeFilter]);

    const selectedRows = useMemo(
        () => rows.filter((row) => selected.has(row.key)),
        [rows, selected]
    );

    const allVisibleSelected =
        visibleRows.length > 0 && visibleRows.every((row) => selected.has(row.key));

    function toggleRow(key: string, checked: boolean) {
        setSelected((current) => {
            const next = new Set(current);
            if (checked) next.add(key);
            else next.delete(key);
            return next;
        });
        setSuccess("");
    }

    function toggleAllVisible(checked: boolean) {
        setSelected((current) => {
            const next = new Set(current);
            for (const row of visibleRows) {
                if (checked) next.add(row.key);
                else next.delete(row.key);
            }
            return next;
        });
        setSuccess("");
    }

    async function deleteSelected() {
        if (!isAdmin || deleting || selectedRows.length === 0) return;

        const recordList = selectedRows
            .map((row) => `• ${row.kind === "request" ? (isAfrikaans ? "Versoek" : "Request") : (isAfrikaans ? "Taak" : "Task")} #${row.id} — ${row.title}`)
            .join("\n");

        const confirmation = isAfrikaans
            ? `Jy gaan ${selectedRows.length} rekord(s) PERMANENT uit die databasis verwyder. Hierdie aksie kan nie ongedaan gemaak word nie. Werkplan- en werkkaartgeskiedenis word behou, maar skakels na verwyderde take word uitgevee.\n\nGeselekteerde rekords:\n${recordList}\n\nGaan voort?`
            : `You are about to PERMANENTLY delete ${selectedRows.length} record(s) from the database. This cannot be undone. Work-plan and job-card history will be preserved, but links to deleted tasks will be cleared.\n\nSelected records:\n${recordList}\n\nContinue?`;

        if (!window.confirm(confirmation)) return;

        const requestIDs = selectedRows
            .filter((row) => row.kind === "request")
            .map((row) => row.id);
        const taskIDs = selectedRows
            .filter((row) => row.kind === "task")
            .map((row) => row.id);

        setDeleting(true);
        setError("");
        setSuccess("");

        try {
            const response = await fetch(`${API_URL}/api/LogisticsAdmin/bulk-hard-delete`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${localStorage.getItem("token")}`,
                },
                body: JSON.stringify({ requestIDs, taskIDs }),
            });

            if (response.status === 401) {
                localStorage.removeItem("token");
                localStorage.removeItem("user");
                router.replace("/login");
                return;
            }

            const body = await response.json().catch(() => ({})) as {
                message?: string;
                deletedRequests?: number;
                deletedTasks?: number;
            };

            if (!response.ok) {
                throw new Error(
                    body.message ||
                    (isAfrikaans
                        ? "Die rekords kon nie permanent verwyder word nie."
                        : "The records could not be permanently deleted.")
                );
            }

            setSelected(new Set());
            setSuccess(
                isAfrikaans
                    ? `Permanent verwyder: ${body.deletedRequests ?? requestIDs.length} versoek(e) en ${body.deletedTasks ?? taskIDs.length} taak/take. Werkplan- en werkkaartgeskiedenis is behou.`
                    : `Permanently deleted: ${body.deletedRequests ?? requestIDs.length} request(s) and ${body.deletedTasks ?? taskIDs.length} task(s). Work-plan and job-card history was preserved.`
            );
            await loadRecords();
            onDeleted();
        } catch (deleteError) {
            setError(
                deleteError instanceof Error
                    ? deleteError.message
                    : isAfrikaans
                      ? "Die rekords kon nie verwyder word nie."
                      : "Unable to delete the records."
            );
        } finally {
            setDeleting(false);
        }
    }

    if (!isAdmin) return null;

    return (
        <section id="permanent-verwyder" className="nkrn-panel mb-8 overflow-hidden rounded-[28px] border border-red-400/15 bg-white/4 shadow-2xl shadow-black/20 backdrop-blur-2xl">
            <div className="border-b border-white/8 p-5 sm:p-6">
                <p className="text-xs font-medium uppercase tracking-[0.22em] text-red-300">
                    {isAfrikaans ? "Administrateur · Gevaarlike aksie" : "Administrator · Destructive action"}
                </p>
                <h2 className="mt-1 text-xl font-semibold">
                    {isAfrikaans ? "Permanente verwydering" : "Permanent deletion"}
                </h2>
                <p className="mt-2 max-w-4xl text-sm text-zinc-400">
                    {isAfrikaans
                        ? "Kies versoeke en take in dieselfde lys en verwyder dit met een aksie. Gekoppelde werkplan- en werkkaartgeskiedenis word behou. Versoeke wat nog aan lokaalbesprekings gekoppel is, kan nie hier verwyder word nie."
                        : "Select requests and tasks in one list and delete them in a single operation. Linked work-plan and job-card history is preserved. Requests still linked to venue bookings cannot be deleted here."}
                </p>
            </div>

            <div className="space-y-4 p-5 sm:p-6">
                {error && <div role="alert" className="rounded-xl border border-red-400/20 bg-red-500/10 p-3 text-sm text-red-200">{error}</div>}
                {success && <div role="status" className="rounded-xl border border-green-400/20 bg-green-500/10 p-3 text-sm text-green-200">{success}</div>}

                <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_200px_auto]">
                    <input
                        aria-label={isAfrikaans ? "Soek rekords" : "Search records"}
                        className={inputClass}
                        placeholder={isAfrikaans ? "Soek ID, titel, status of persoon…" : "Search ID, title, status or person…"}
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                    />
                    <select
                        aria-label={isAfrikaans ? "Rekordtipe" : "Record type"}
                        className={inputClass}
                        value={typeFilter}
                        onChange={(event) => setTypeFilter(event.target.value as typeof typeFilter)}
                    >
                        <option value="all">{isAfrikaans ? "Versoeke en take" : "Requests and tasks"}</option>
                        <option value="request">{isAfrikaans ? "Slegs versoeke" : "Requests only"}</option>
                        <option value="task">{isAfrikaans ? "Slegs take" : "Tasks only"}</option>
                    </select>
                    <button type="button" className={buttonClass} onClick={() => void loadRecords()} disabled={loading || deleting}>
                        {loading ? (isAfrikaans ? "Laai…" : "Loading…") : (isAfrikaans ? "Verfris lys" : "Refresh list")}
                    </button>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="text-sm text-zinc-300">
                        <strong>{selectedRows.length}</strong> {isAfrikaans ? "gekies" : "selected"} · {visibleRows.length} {isAfrikaans ? "sigbaar" : "visible"} · {rows.length} {isAfrikaans ? "totaal" : "total"}
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <button type="button" className={buttonClass} onClick={() => toggleAllVisible(!allVisibleSelected)} disabled={visibleRows.length === 0 || deleting}>
                            {allVisibleSelected ? (isAfrikaans ? "Ontkies sigbares" : "Deselect visible") : (isAfrikaans ? "Kies alle sigbares" : "Select all visible")}
                        </button>
                        <button type="button" className={buttonClass} onClick={() => { setSelected(new Set()); setSuccess(""); }} disabled={selected.size === 0 || deleting}>
                            {isAfrikaans ? "Maak keuse skoon" : "Clear selection"}
                        </button>
                        <button
                            type="button"
                            onClick={() => void deleteSelected()}
                            disabled={selectedRows.length === 0 || deleting || loading}
                            className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-2.5 text-sm font-semibold text-red-200 transition hover:bg-red-500/15 disabled:cursor-not-allowed disabled:opacity-45"
                        >
                            {deleting
                                ? (isAfrikaans ? "Verwyder…" : "Deleting…")
                                : (isAfrikaans ? `Verwyder gekose permanent (${selectedRows.length})` : `Permanently delete selected (${selectedRows.length})`)}
                        </button>
                    </div>
                </div>

                <div className="overflow-x-auto rounded-2xl border border-white/10">
                    <table className="min-w-full text-left text-sm">
                        <thead className="bg-black/20 text-xs uppercase tracking-[0.1em] text-zinc-500">
                            <tr>
                                <th className="w-12 px-4 py-3">
                                    <input
                                        type="checkbox"
                                        aria-label={isAfrikaans ? "Kies alle sigbare rekords" : "Select all visible records"}
                                        checked={allVisibleSelected}
                                        onChange={(event) => toggleAllVisible(event.target.checked)}
                                        disabled={visibleRows.length === 0 || deleting}
                                    />
                                </th>
                                <th className="px-4 py-3">{isAfrikaans ? "Tipe / ID" : "Type / ID"}</th>
                                <th className="px-4 py-3">{isAfrikaans ? "Titel" : "Title"}</th>
                                <th className="px-4 py-3">{isAfrikaans ? "Status" : "Status"}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/6">
                            {visibleRows.map((row) => (
                                <tr key={row.key} className={selected.has(row.key) ? "bg-red-500/5" : "hover:bg-white/[0.025]"}>
                                    <td className="px-4 py-3">
                                        <input
                                            type="checkbox"
                                            aria-label={`Select ${row.kind} #${row.id}`}
                                            checked={selected.has(row.key)}
                                            onChange={(event) => toggleRow(row.key, event.target.checked)}
                                            disabled={deleting}
                                        />
                                    </td>
                                    <td className="whitespace-nowrap px-4 py-3 text-zinc-300">
                                        <span className={row.kind === "request" ? "text-blue-300" : "text-yellow-300"}>
                                            {row.kind === "request" ? (isAfrikaans ? "Versoek" : "Request") : (isAfrikaans ? "Taak" : "Task")}
                                        </span>
                                        <span className="ml-2 text-zinc-500">#{row.id}</span>
                                    </td>
                                    <td className="min-w-[240px] px-4 py-3">
                                        <div className="font-medium text-zinc-100">{row.title}</div>
                                        {row.detail && <div className="mt-1 text-xs text-zinc-500">{row.detail}</div>}
                                    </td>
                                    <td className="whitespace-nowrap px-4 py-3 text-zinc-400">{row.status}</td>
                                </tr>
                            ))}
                            {visibleRows.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="px-4 py-10 text-center text-sm text-zinc-500">
                                        {loading
                                            ? (isAfrikaans ? "Rekords word gelaai…" : "Loading records…")
                                            : (isAfrikaans ? "Geen rekords pas by die soektog nie." : "No records match this search.")}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                <p className="text-xs leading-5 text-zinc-500">
                    {isAfrikaans
                        ? "Let wel: versoekkommentaar word saam met die versoek verwyder. Werkplanitems, kalender-sinkronisering, werkkaarte en werkkaartitems se historiese inhoud word behou; verwysings na take wat verwyder word, word skoongemaak."
                        : "Note: request comments are deleted with the request. Work-plan items, calendar-sync data, job cards and job-card item snapshots are retained; references to deleted tasks are cleared."}
                </p>
            </div>
        </section>
    );
}
