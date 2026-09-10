"use client";

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
    departments: LogisticsDepartment[];
    workers: LogisticsWorker[];
    onTaskConverted: () => void;
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
    if (!value) return "â€”";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return value;
    }

    return date.toLocaleDateString("en-ZA", {
        day: "2-digit",
        month: "short",
        year: "numeric",
    });
}

function displayDateTime(value?: string | null) {
    if (!value) return "â€”";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return value;
    }

    return date.toLocaleString("en-ZA", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

function shortTime(value?: string | null) {
    if (!value) return "â€”";
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
    const value = status.toLowerCase();

    if (value === "new") {
        return "border-yellow-400/20 bg-yellow-500/10 text-yellow-200";
    }

    if (value === "under review" || value === "needs information") {
        return "border-orange-400/20 bg-orange-500/10 text-orange-200";
    }

    if (value === "approved") {
        return "border-blue-400/20 bg-blue-500/10 text-blue-200";
    }

    if (value === "converted" || value === "completed") {
        return "border-green-400/20 bg-green-500/10 text-green-200";
    }

    if (value === "declined" || value === "cancelled") {
        return "border-red-400/20 bg-red-500/10 text-red-200";
    }

    return "border-white/10 bg-white/5 text-zinc-300";
}

function isOpenRequest(request: LogisticsRequest) {
    return !["Converted", "Completed", "Declined", "Cancelled"].includes(
        request.status
    );
}

export default function LogisticsRequestInbox({
    departments,
    workers,
    onTaskConverted,
}: LogisticsRequestInboxProps) {
    const [requests, setRequests] = useState<LogisticsRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [filter, setFilter] = useState("Open");
    const [selectedRequest, setSelectedRequest] =
        useState<LogisticsRequest | null>(null);

    const [reviewStatus, setReviewStatus] = useState("Under Review");
    const [managerNotes, setManagerNotes] = useState("");
    const [departmentID, setDepartmentID] = useState("");
    const [workerID, setWorkerID] = useState("");
    const [priority, setPriority] = useState("P3");
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
                window.location.assign("/login");
                return;
            }

            if (response.status === 403) {
                throw new Error(
                    "Your account does not have permission to manage Logistics requests."
                );
            }

            if (!response.ok) {
                throw new Error(
                    `Unable to load Logistics requests (${response.status}).`
                );
            }

            setRequests((await response.json()) as LogisticsRequest[]);
        } catch (loadError) {
            setError(
                loadError instanceof Error
                    ? loadError.message
                    : "Unable to load Logistics requests."
            );
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadRequests();
    }, [loadRequests]);

    const visibleRequests = useMemo(() => {
        if (filter === "All") {
            return requests;
        }

        if (filter === "Open") {
            return requests.filter(isOpenRequest);
        }

        return requests.filter((request) => request.status === filter);
    }, [requests, filter]);

    const newCount = requests.filter(
        (request) => request.status === "New"
    ).length;

    const openCount = requests.filter(isOpenRequest).length;

    function openRequest(request: LogisticsRequest) {
        setSelectedRequest(request);
        setReviewStatus(
            ["New", "Under Review", "Needs Information", "Approved", "Declined"].includes(
                request.status
            )
                ? request.status
                : "Under Review"
        );
        setManagerNotes(request.managerNotes || "");
        setDepartmentID("");
        setWorkerID("");
        setPriority(request.priority || "P3");
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
        if (savingReview || converting) {
            return;
        }

        setSelectedRequest(null);
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
                    }),
                }
            );

            if (!response.ok) {
                let message = "Unable to save the request review.";

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
                `Request #${selectedRequest.requestID} was updated to ${reviewStatus}.`
            );

            setSelectedRequest(null);
            await loadRequests();
        } catch (reviewError) {
            setError(
                reviewError instanceof Error
                    ? reviewError.message
                    : "Unable to save the request review."
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
            `Convert Logistics Request #${selectedRequest.requestID} into an operational task?`
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
                let message = "Unable to convert this request to a task.";

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
                    : "Unable to convert this request to a task."
            );
        } finally {
            setConverting(false);
        }
    }

    return (
        <>
            <section className="nkrn-panel mb-8 overflow-hidden rounded-[28px] border border-white/10 bg-white/4 shadow-2xl shadow-black/20 backdrop-blur-2xl">
                <div className="border-b border-white/8 p-5 sm:p-6">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                            <p className="text-xs font-medium uppercase tracking-[0.22em] text-yellow-400">
                                Staff Requests
                            </p>
                            <div className="mt-1 flex flex-wrap items-center gap-3">
                                <h2 className="text-xl font-semibold">
                                    Logistics Request Inbox
                                </h2>
                                {newCount > 0 && (
                                    <span className="rounded-full border border-yellow-400/20 bg-yellow-500/10 px-2.5 py-1 text-xs font-semibold text-yellow-200">
                                        {newCount} new
                                    </span>
                                )}
                            </div>
                            <p className="mt-1 text-sm text-zinc-500">
                                Review staff submissions before turning approved work into operational tasks.
                            </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-3">
                            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-zinc-400">
                                {openCount} open
                            </span>

                            <select
                                value={filter}
                                onChange={(event) => setFilter(event.target.value)}
                                className="nkrn-select rounded-xl border border-white/10 bg-zinc-900/70 px-3.5 py-2.5 text-sm text-white outline-none"
                            >
                                <option value="Open">Open requests</option>
                                <option value="New">New</option>
                                <option value="Under Review">Under Review</option>
                                <option value="Needs Information">Needs Information</option>
                                <option value="Approved">Approved</option>
                                <option value="Converted">Converted</option>
                                <option value="Declined">Declined</option>
                                <option value="Cancelled">Cancelled</option>
                                <option value="All">All requests</option>
                            </select>

                            <button
                                type="button"
                                onClick={() => void loadRequests()}
                                className={secondaryButton}
                            >
                                Refresh Requests
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
                        Loading Logistics requestsâ€¦
                    </div>
                ) : visibleRequests.length === 0 ? (
                    <div className="p-5 sm:p-6">
                        <div className="rounded-2xl border border-dashed border-white/10 bg-black/10 p-6 text-sm text-zinc-500">
                            No Logistics requests match the current filter.
                        </div>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-left text-sm">
                            <thead className="border-b border-white/8 bg-black/15 text-xs uppercase tracking-[0.12em] text-zinc-500">
                                <tr>
                                    <th className="px-5 py-4 font-medium">Request</th>
                                    <th className="px-5 py-4 font-medium">Submitted By</th>
                                    <th className="px-5 py-4 font-medium">Type</th>
                                    <th className="px-5 py-4 font-medium">Location</th>
                                    <th className="px-5 py-4 font-medium">Submitted</th>
                                    <th className="px-5 py-4 font-medium">Status</th>
                                    <th className="px-5 py-4 text-right font-medium">Action</th>
                                </tr>
                            </thead>

                            <tbody className="divide-y divide-white/6">
                                {visibleRequests.map((request) => (
                                    <tr
                                        key={request.requestID}
                                        className="transition hover:bg-white/2.5"
                                    >
                                        <td className="min-w-72 px-5 py-4">
                                            <p className="font-medium text-zinc-100">
                                                {request.title}
                                            </p>
                                            <p className="mt-1 font-mono text-xs text-zinc-600">
                                                Request #{request.requestID}
                                                {request.convertedTaskID
                                                    ? ` Â· Task #${request.convertedTaskID}`
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
                                            {request.requestType}
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
                                                {request.status}
                                            </span>
                                        </td>

                                        <td className="px-5 py-4 text-right">
                                            <button
                                                type="button"
                                                onClick={() => openRequest(request)}
                                                className={secondaryButton}
                                            >
                                                Review
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
                                    Logistics Request #{selectedRequest.requestID}
                                </p>
                                <h2 className="mt-1 text-2xl font-semibold">
                                    {selectedRequest.title}
                                </h2>
                                <p className="mt-2 text-sm text-zinc-500">
                                    Submitted by {selectedRequest.requestedByName} Â·{" "}
                                    {displayDateTime(selectedRequest.createdDate)}
                                </p>
                            </div>

                            <button
                                type="button"
                                onClick={closeRequest}
                                disabled={savingReview || converting}
                                className={secondaryButton}
                            >
                                Close
                            </button>
                        </div>

                        <div className="mt-6 grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
                            <div className="space-y-5">
                                <div className="rounded-2xl border border-white/8 bg-black/15 p-5">
                                    <div className="grid gap-4 sm:grid-cols-2">
                                        <Info
                                            label="Request Type"
                                            value={selectedRequest.requestType}
                                        />
                                        <Info
                                            label="Location"
                                            value={primaryLocation(selectedRequest)}
                                        />
                                        <Info
                                            label="Activity Category"
                                            value={selectedRequest.activityCategory || "â€”"}
                                        />
                                        <Info
                                            label="Activity Date"
                                            value={displayDate(selectedRequest.activityDate)}
                                        />
                                        <Info
                                            label="Time"
                                            value={
                                                selectedRequest.startTime || selectedRequest.endTime
                                                    ? `${shortTime(selectedRequest.startTime)}â€“${shortTime(
                                                          selectedRequest.endTime
                                                      )}`
                                                    : "â€”"
                                            }
                                        />
                                        <Info
                                            label="Current Status"
                                            value={selectedRequest.status}
                                        />
                                    </div>

                                    <div className="mt-5">
                                        <p className="text-[11px] uppercase tracking-[0.14em] text-zinc-600">
                                            Description
                                        </p>
                                        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-zinc-300">
                                            {selectedRequest.description || "No description supplied."}
                                        </p>
                                    </div>
                                </div>

                                {selectedRequest.maintenanceItems.length > 0 && (
                                    <div className="rounded-2xl border border-white/8 bg-black/15 p-5">
                                        <p className="text-[11px] uppercase tracking-[0.14em] text-zinc-600">
                                            Maintenance
                                        </p>
                                        <div className="mt-3 space-y-2">
                                            {selectedRequest.maintenanceItems.map((item) => (
                                                <div
                                                    key={item.requestMaintenanceItemID}
                                                    className="rounded-xl border border-white/8 bg-white/2.5 px-4 py-3 text-sm text-zinc-300"
                                                >
                                                    {item.maintenanceName} Â· {item.actionType}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {selectedRequest.equipment.length > 0 && (
                                    <div className="rounded-2xl border border-white/8 bg-black/15 p-5">
                                        <p className="text-[11px] uppercase tracking-[0.14em] text-zinc-600">
                                            Equipment
                                        </p>
                                        <div className="mt-3 flex flex-wrap gap-2">
                                            {selectedRequest.equipment.map((item) => (
                                                <span
                                                    key={item.requestEquipmentID}
                                                    className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-zinc-300"
                                                >
                                                    {item.equipmentName}
                                                    {item.quantity ? ` Ã— ${item.quantity}` : ""}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="space-y-5">
                                <div className="rounded-2xl border border-white/8 bg-black/15 p-5">
                                    <p className="text-xs font-medium uppercase tracking-[0.18em] text-yellow-400">
                                        Review
                                    </p>

                                    <label className="mt-4 block">
                                        <span className="mb-2 block text-xs uppercase tracking-[0.12em] text-zinc-500">
                                            Request Status
                                        </span>
                                        <select
                                            value={reviewStatus}
                                            onChange={(event) =>
                                                setReviewStatus(event.target.value)
                                            }
                                            className={selectClass}
                                        >
                                            <option value="New">New</option>
                                            <option value="Under Review">Under Review</option>
                                            <option value="Needs Information">
                                                Needs Information
                                            </option>
                                            <option value="Approved">Approved</option>
                                            <option value="Declined">Declined</option>
                                        </select>
                                    </label>

                                    <label className="mt-4 block">
                                        <span className="mb-2 block text-xs uppercase tracking-[0.12em] text-zinc-500">
                                            Manager Notes
                                        </span>
                                        <textarea
                                            value={managerNotes}
                                            onChange={(event) =>
                                                setManagerNotes(event.target.value)
                                            }
                                            rows={4}
                                            placeholder="Optional review notes"
                                            className={`${inputClass} resize-y`}
                                        />
                                    </label>

                                    <button
                                        type="button"
                                        onClick={() => void saveReview()}
                                        disabled={savingReview || converting}
                                        className="mt-4 w-full rounded-xl border border-white/10 bg-white/7 px-4 py-3 text-sm font-semibold text-zinc-100 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-45"
                                    >
                                        {savingReview ? "Savingâ€¦" : "Save Review"}
                                    </button>
                                </div>

                                {isOpenRequest(selectedRequest) && (
                                    <div className="rounded-2xl border border-yellow-400/15 bg-yellow-500/5 p-5">
                                        <p className="text-xs font-medium uppercase tracking-[0.18em] text-yellow-400">
                                            Convert to Operational Task
                                        </p>
                                        <p className="mt-2 text-xs leading-5 text-zinc-500">
                                            This creates a Logistics task and links this request to it in one transaction.
                                        </p>

                                        <div className="mt-4 grid gap-4 sm:grid-cols-2">
                                            <label className="block">
                                                <span className="mb-2 block text-xs uppercase tracking-[0.12em] text-zinc-500">
                                                    Department
                                                </span>
                                                <select
                                                    value={departmentID}
                                                    onChange={(event) =>
                                                        setDepartmentID(event.target.value)
                                                    }
                                                    className={selectClass}
                                                >
                                                    <option value="">Unassigned</option>
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
                                                    Worker
                                                </span>
                                                <select
                                                    value={workerID}
                                                    onChange={(event) =>
                                                        setWorkerID(event.target.value)
                                                    }
                                                    className={selectClass}
                                                >
                                                    <option value="">Unassigned</option>
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
                                                                    ? ` Â· ${worker.workerType}`
                                                                    : ""}
                                                            </option>
                                                        ))}
                                                </select>
                                            </label>

                                            <label className="block">
                                                <span className="mb-2 block text-xs uppercase tracking-[0.12em] text-zinc-500">
                                                    Priority
                                                </span>
                                                <select
                                                    value={priority}
                                                    onChange={(event) =>
                                                        setPriority(event.target.value)
                                                    }
                                                    className={selectClass}
                                                >
                                                    <option value="P1">P1 Â· Critical</option>
                                                    <option value="P2">P2 Â· Urgent</option>
                                                    <option value="P3">P3 Â· Planned</option>
                                                    <option value="P4">P4 Â· Improvement</option>
                                                </select>
                                            </label>

                                            <label className="block">
                                                <span className="mb-2 block text-xs uppercase tracking-[0.12em] text-zinc-500">
                                                    Due Date
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
                                                Next Action
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
                                                Include this task when generating job cards
                                            </span>
                                        </label>

                                        <button
                                            type="button"
                                            onClick={() => void convertToTask()}
                                            disabled={converting || savingReview}
                                            className="mt-5 w-full rounded-xl border border-yellow-300/20 bg-yellow-400 px-4 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-yellow-300 disabled:cursor-not-allowed disabled:opacity-50"
                                        >
                                            {converting
                                                ? "Convertingâ€¦"
                                                : "Approve & Convert to Task"}
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
