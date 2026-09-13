"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import "../nkrn-control.css";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

interface User {
    userID: number;
    firstName: string;
    lastName: string;
    email: string;
    roleID: number;
}

interface RequestModel {
    requestID: number;
    userID: number;
    title: string;
    description: string;
    priority: string;
    assignedTo: number | null;
    createdDate: string | null;
    completedDate: string | null;
    categoryID: number | null;
    statusID: number;
    requester?: User;
    assignedTechnician?: User;
}

interface Category {
    categoryID: number;
    categoryName: string;
}

interface Comment {
    commentID: number;
    requestID: number;
    userID: number;
    comment: string;
    createdDate: string;
    user?: User;
}

interface RequestUpdate {
    assignedTo: number | null;
    statusID: number;
    priority: string;
    completedDate: string | null;
}

const glassCard =
    "nkrn-panel border border-white/10 bg-white/[0.045]";

const inputClass =
    "nkrn-input w-full border border-white/10 bg-zinc-900/70 p-3 text-sm text-white placeholder:text-zinc-600 outline-none transition focus:border-white/25 focus:bg-zinc-900";

const selectClass =
    "nkrn-select w-full border border-white/10 bg-zinc-900/70 p-3 text-sm text-white outline-none transition focus:border-white/25 focus:bg-zinc-900";

export default function TechPage() {
    const router = useRouter();

    const [user, setUser] = useState<User | null>(null);
    const [checkingUser, setCheckingUser] = useState(true);

    const [requests, setRequests] = useState<RequestModel[]>([]);
    const [technicians, setTechnicians] = useState<User[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);

    const [selectedRequest, setSelectedRequest] =
        useState<RequestModel | null>(null);

    const [comments, setComments] = useState<Comment[]>([]);
    const [newComment, setNewComment] = useState("");

    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("All");
    const [priorityFilter, setPriorityFilter] = useState("All");

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [commentsLoading, setCommentsLoading] = useState(false);
    const [message, setMessage] = useState("");

    const [editAssignedTo, setEditAssignedTo] =
        useState<number | null>(null);
    const [editStatusID, setEditStatusID] = useState(1);
    const [editPriority, setEditPriority] = useState("Medium");

    // =========================================================
    // AUTH
    // =========================================================

    useEffect(() => {
        let cancelled = false;

        async function restoreUser() {
            await Promise.resolve();

            if (cancelled) {
                return;
            }

            const token = localStorage.getItem("token");
            const storedUser = localStorage.getItem("user");

            if (!token || !storedUser) {
                router.replace("/login");
                return;
            }

            try {
                const parsedUser = JSON.parse(storedUser) as User;

                if (parsedUser.roleID !== 2 && parsedUser.roleID !== 3) {
                    router.replace("/requests");
                    return;
                }

                if (!cancelled) {
                    setUser(parsedUser);
                }
            } catch (error) {
                console.error("Unable to restore user.", error);

                localStorage.removeItem("token");
                localStorage.removeItem("user");

                router.replace("/login");
            } finally {
                if (!cancelled) {
                    setCheckingUser(false);
                }
            }
        }

        void restoreUser();

        return () => {
            cancelled = true;
        };
    }, [router]);

    // =========================================================
    // AUTH HEADERS
    // =========================================================

    const getHeaders = useCallback((): HeadersInit => {
        const token = localStorage.getItem("token");

        return {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
        };
    }, []);

    // =========================================================
    // LOAD DASHBOARD
    // =========================================================

    const loadDashboard = useCallback(async () => {
        setLoading(true);
        setMessage("");

        try {
            const [
                requestsResponse,
                usersResponse,
                categoriesResponse,
            ] = await Promise.all([
                fetch(`${API_URL}/api/Requests`, {
                    method: "GET",
                    headers: getHeaders(),
                }),
                fetch(`${API_URL}/api/Users`, {
                    method: "GET",
                    headers: getHeaders(),
                }),
                fetch(`${API_URL}/api/Categories`, {
                    method: "GET",
                    headers: getHeaders(),
                }),
            ]);

            if (requestsResponse.status === 401) {
                localStorage.removeItem("token");
                localStorage.removeItem("user");
                router.replace("/login");
                return;
            }

            if (!requestsResponse.ok) {
                throw new Error(
                    `Requests request failed: ${requestsResponse.status}`
                );
            }

            const requestsData =
                (await requestsResponse.json()) as RequestModel[];

            let usersData: User[] = [];
            let categoriesData: Category[] = [];

            if (usersResponse.ok) {
                usersData = (await usersResponse.json()) as User[];
            }

            if (categoriesResponse.ok) {
                categoriesData =
                    (await categoriesResponse.json()) as Category[];
            }

            setRequests(requestsData);

            // =====================================================
            // ALL USERS
            //
            // Keep the complete user list separately so that the
            // dashboard can display the name of whoever is assigned
            // to a request, including administrators.
            // =====================================================

            setUsers(usersData);

            // =====================================================
            // ASSIGNABLE USERS
            //
            // Technicians can assign requests to technicians.
            // Administrators can assign requests to technicians
            // OR administrators.
            // =====================================================

            setTechnicians(
                usersData.filter(
                    (item) =>
                        item.roleID === 2 ||
                        (user?.roleID === 3 && item.roleID === 3)
                )
            );

            setCategories(categoriesData);
        } catch (error) {
            console.error(
                "Failed to load technician dashboard:",
                error
            );

            setMessage(
                "Unable to load the technician dashboard."
            );
        } finally {
            setLoading(false);
        }
    }, [getHeaders, router, user]);

    // =========================================================
    // LOAD DASHBOARD AFTER AUTH
    //
    // The timeout intentionally moves dashboard state updates
    // outside the synchronous effect execution. This avoids the
    // react-hooks/set-state-in-effect ESLint error.
    // =========================================================

    useEffect(() => {
        if (!user) {
            return;
        }

        const timer = window.setTimeout(() => {
            void loadDashboard();
        }, 0);

        return () => {
            window.clearTimeout(timer);
        };
    }, [user, loadDashboard]);

    // =========================================================
    // SELECT REQUEST
    // =========================================================

    const loadComments = useCallback(
        async (requestID: number) => {
            setCommentsLoading(true);

            try {
                const response = await fetch(
                    `${API_URL}/api/RequestComments/request/${requestID}`,
                    {
                        method: "GET",
                        headers: getHeaders(),
                    }
                );

                if (!response.ok) {
                    setComments([]);
                    return;
                }

                const data = (await response.json()) as Comment[];

                setComments(data);
            } catch (error) {
                console.error(
                    "Failed to load comments:",
                    error
                );

                setComments([]);
            } finally {
                setCommentsLoading(false);
            }
        },
        [getHeaders]
    );

    async function selectRequest(request: RequestModel) {
        setSelectedRequest(request);
        setEditAssignedTo(request.assignedTo);
        setEditStatusID(request.statusID);
        setEditPriority(request.priority);
        setNewComment("");

        await loadComments(request.requestID);
    }

    // =========================================================
    // SAVE REQUEST
    // =========================================================

    async function saveRequest() {
        if (!selectedRequest) {
            return;
        }

        setSaving(true);
        setMessage("");

        try {
            const update: RequestUpdate = {
                assignedTo: editAssignedTo,
                statusID: editStatusID,
                priority: editPriority,
                completedDate:
                    editStatusID === 3
                        ? selectedRequest.completedDate ??
                          new Date().toISOString()
                        : null,
            };

            const response = await fetch(
                `${API_URL}/api/Requests/${selectedRequest.requestID}`,
                {
                    method: "PUT",
                    headers: getHeaders(),
                    body: JSON.stringify(update),
                }
            );

            if (response.status === 401) {
                localStorage.removeItem("token");
                localStorage.removeItem("user");
                router.replace("/login");
                return;
            }

            if (!response.ok) {
                const errorText = await response.text();

                throw new Error(
                    errorText ||
                        `Request update failed: ${response.status}`
                );
            }

            setMessage(
                `Request #${selectedRequest.requestID} updated successfully.`
            );

            await loadDashboard();

            const refreshedResponse = await fetch(
                `${API_URL}/api/Requests`,
                {
                    method: "GET",
                    headers: getHeaders(),
                }
            );

            if (refreshedResponse.ok) {
                const refreshed =
                    (await refreshedResponse.json()) as RequestModel[];

                setRequests(refreshed);

                const updated = refreshed.find(
                    (item) =>
                        item.requestID ===
                        selectedRequest.requestID
                );

                if (updated) {
                    setSelectedRequest(updated);
                    setEditAssignedTo(updated.assignedTo);
                    setEditStatusID(updated.statusID);
                    setEditPriority(updated.priority);
                }
            }
        } catch (error) {
            console.error(
                "Unable to update request:",
                error
            );

            setMessage(
                "Something went wrong while updating the request."
            );
        } finally {
            setSaving(false);
        }
    }

    // =========================================================
    // ADD COMMENT
    // =========================================================

    async function addComment() {
        if (!selectedRequest || !user) {
            return;
        }

        const trimmedComment = newComment.trim();

        if (!trimmedComment) {
            return;
        }

        try {
            const response = await fetch(
                `${API_URL}/api/RequestComments`,
                {
                    method: "POST",
                    headers: getHeaders(),
                    body: JSON.stringify({
                        requestID:
                            selectedRequest.requestID,
                        userID: user.userID,
                        comment: trimmedComment,
                    }),
                }
            );

            if (!response.ok) {
                throw new Error(
                    `Comment failed: ${response.status}`
                );
            }

            setNewComment("");

            await loadComments(
                selectedRequest.requestID
            );
        } catch (error) {
            console.error(
                "Unable to add comment:",
                error
            );

            setMessage(
                "Unable to add the comment."
            );
        }
    }

    // =========================================================
    // FILTERED REQUESTS
    // =========================================================

    const filteredRequests = useMemo(() => {
        return requests.filter((request) => {
            const searchText = search
                .trim()
                .toLowerCase();

            const matchesSearch =
                !searchText ||
                request.title
                    .toLowerCase()
                    .includes(searchText) ||
                request.description
                    .toLowerCase()
                    .includes(searchText) ||
                String(request.requestID).includes(
                    searchText
                );

            const matchesStatus =
                statusFilter === "All" ||
                String(request.statusID) ===
                    statusFilter;

            const matchesPriority =
                priorityFilter === "All" ||
                request.priority ===
                    priorityFilter;

            return (
                matchesSearch &&
                matchesStatus &&
                matchesPriority
            );
        });
    }, [
        requests,
        search,
        statusFilter,
        priorityFilter,
    ]);

    // =========================================================
    // DASHBOARD COUNTS
    // =========================================================

    const totalRequests = requests.length;

    const loggedRequests = requests.filter(
        (request) => request.statusID === 1
    ).length;

    const busyRequests = requests.filter(
        (request) => request.statusID === 2
    ).length;

    const completedRequests = requests.filter(
        (request) => request.statusID === 3
    ).length;

    // =========================================================
    // LABELS
    // =========================================================

    function getStatusLabel(statusID: number) {
        switch (statusID) {
            case 1:
                return "Logged";
            case 2:
                return "Busy";
            case 3:
                return "Done";
            default:
                return "Unknown";
        }
    }

    function getStatusClass(statusID: number) {
        switch (statusID) {
            case 1:
                return "border-red-400/10 bg-red-500/10 text-red-300";
            case 2:
                return "border-orange-400/10 bg-orange-500/10 text-orange-300";
            case 3:
                return "border-green-400/10 bg-green-500/10 text-green-300";
            default:
                return "border-white/10 bg-white/5 text-zinc-400";
        }
    }

    function getPriorityClass(priority: string) {
        switch (priority) {
            case "Critical":
                return "border-red-400/20 bg-red-500/10 text-red-300";
            case "High":
                return "border-orange-400/20 bg-orange-500/10 text-orange-300";
            case "Medium":
                return "border-yellow-400/20 bg-yellow-500/10 text-yellow-300";
            case "Low":
                return "border-green-400/20 bg-green-500/10 text-green-300";
            default:
                return "border-white/10 bg-white/5 text-zinc-400";
        }
    }

    function getCategoryName(
        categoryID: number | null
    ) {
        if (categoryID === null) {
            return "Unknown";
        }

        const category = categories.find(
            (item) =>
                item.categoryID === categoryID
        );

        return (
            category?.categoryName ??
            "Unknown"
        );
    }

    function getTechnicianName(
        technicianID: number | null
    ) {
        if (technicianID === null) {
            return "Unassigned";
        }

        // Use the complete user list here rather than the
        // assignable technician list. This allows the dashboard
        // to display administrators who have been assigned to
        // requests as well.
        const assignedUser = users.find(
            (item) =>
                item.userID === technicianID
        );

        if (!assignedUser) {
            return "Unknown technician";
        }

        return `${assignedUser.firstName} ${assignedUser.lastName}`;
    }

    // =========================================================
    // FORMAT DATE
    // =========================================================

    function formatDate(
        date: string | null
    ) {
        if (!date) {
            return "—";
        }

        const parsed = new Date(date);

        if (Number.isNaN(parsed.getTime())) {
            return date;
        }

        return parsed.toLocaleString(
            "en-ZA",
            {
                day: "2-digit",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
            }
        );
    }

    // =========================================================
    // LOGOUT
    // =========================================================

    function logout() {
        localStorage.removeItem("token");
        localStorage.removeItem("user");

        router.push("/login");
    }

    // =========================================================
    // EXPORT CSV
    // =========================================================

    function exportCSV() {
        if (filteredRequests.length === 0) {
            return;
        }

        const headers = [
            "Request ID",
            "Title",
            "Description",
            "Priority",
            "Status",
            "Category",
            "Assigned To",
            "Created Date",
            "Completed Date",
        ];

        const rows = filteredRequests.map(
            (request) => [
                request.requestID,
                request.title,
                request.description,
                request.priority,
                getStatusLabel(
                    request.statusID
                ),
                getCategoryName(
                    request.categoryID
                ),
                getTechnicianName(
                    request.assignedTo
                ),
                request.createdDate ?? "",
                request.completedDate ?? "",
            ]
        );

        const escapeCSV = (
            value: string | number
        ) =>
            `"${String(value).replace(
                /"/g,
                '""'
            )}"`;

        const csv = [
            headers.map(escapeCSV).join(","),
            ...rows.map((row) =>
                row.map(escapeCSV).join(",")
            ),
        ].join("\n");

        const blob = new Blob(
            [csv],
            {
                type: "text/csv;charset=utf-8;",
            }
        );

        const url =
            URL.createObjectURL(blob);

        const link =
            document.createElement("a");

        link.href = url;

        link.download =
            `tygerpoort-it-requests-${new Date()
                .toISOString()
                .slice(0, 10)}.csv`;

        document.body.appendChild(link);

        link.click();

        link.remove();

        URL.revokeObjectURL(url);
    }

    // =========================================================
    // LOADING SCREEN
    // =========================================================

    if (checkingUser || loading) {
        return (
            <main className="nkrn-control relative flex min-h-screen items-center justify-center overflow-hidden bg-zinc-950 text-white">
                <div className="pointer-events-none absolute inset-0 overflow-hidden">
                    <div className="absolute -left-40 -top-40 h-125 w-125 rounded-full bg-white/3.5 blur-3xl" />

                    <div className="absolute -right-40 top-1/4 h-150 w-150 rounded-full bg-white/2.5 blur-3xl" />

                    <div className="absolute -bottom-62.5 left-1/3 h-125 w-125 rounded-full bg-white/2 blur-3xl" />
                </div>

                <div className="relative text-center">
                    <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl">
                        <div className="h-5 w-5 animate-pulse rounded-full bg-white/60" />
                    </div>

                    <p className="text-sm text-zinc-400">
                        Loading technician dashboard...
                    </p>
                </div>
            </main>
        );
    }

    if (!user) {
        return null;
    }

    // =========================================================
    // PAGE
    // =========================================================

    return (
        <main className="nkrn-control nkrn-tech relative min-h-screen overflow-hidden bg-zinc-950 text-white">
            {/* BACKGROUND */}

            <div className="pointer-events-none fixed inset-0 overflow-hidden">
                <div className="absolute -left-40 -top-40 h-125 w-125 rounded-full bg-white/3.5 blur-3xl" />

                <div className="absolute -right-40 top-1/4 h-150 w-150 rounded-full bg-white/2.5 blur-3xl" />

                <div className="absolute -bottom-62.5 left-1/3 h-125 w-125 rounded-full bg-white/2 blur-3xl" />
            </div>

            <div className="relative mx-auto w-full max-w-375 px-5 py-8 sm:px-8 lg:px-10">
                {/* HEADER */}

                <header
                    className={`${glassCard} nkrn-hero mb-8 p-5 sm:p-7`}
                >
                    <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                        <div className="flex items-center gap-5">
                            <div className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-white/4">
                                <Image
                                    src="/wit-logo-tygies.png"
                                    alt="Laerskool Tygerpoort Logo"
                                    width={150}
                                    height={60}
                                    className="h-auto w-30 object-contain"
                                    priority
                                />
                            </div>

                            <div>
                                <p className="mb-1 text-xs font-medium uppercase tracking-[0.25em] text-zinc-500">
                                    Laerskool Tygerpoort
                                </p>

                                <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                                    IT Technician Dashboard
                                </h1>

                                <p className="mt-1 text-sm text-zinc-400">
                                    Welcome{" "}
                                    {user.firstName}. Manage
                                    and resolve IT support
                                    requests.
                                </p>
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                            <button
                                type="button"
                                onClick={() =>
                                    router.push(
                                        "/requests"
                                    )
                                }
                                className="rounded-xl border border-white/10 bg-white/6 px-4 py-2.5 text-sm font-medium text-zinc-200 transition hover:bg-white/10"
                            >
                                Requests
                            </button>

                            {user.roleID === 3 && (
                                <button
                                    type="button"
                                    onClick={() =>
                                        router.push(
                                            "/Admin"
                                        )
                                    }
                                    className="rounded-xl border border-white/10 bg-white/6 px-4 py-2.5 text-sm font-medium text-zinc-200 transition hover:bg-white/10"
                                >
                                    Admin
                                </button>
                            )}

                            <button
                                type="button"
                                onClick={() => router.push("/")}
                                className="rounded-xl border border-[#d7a31f]/25 bg-[#d7a31f]/8 px-4 py-2.5 text-sm font-medium text-[#e7b42b] transition hover:border-[#d7a31f]/40 hover:bg-[#d7a31f]/12"
                            >
                                NKRN Home
                            </button>

                            <button
                                type="button"
                                onClick={logout}
                                className="rounded-xl border border-red-400/10 bg-red-500/8 px-4 py-2.5 text-sm font-medium text-red-300 transition hover:bg-red-500/14"
                            >
                                Log Out
                            </button>
                        </div>
                    </div>
                </header>

                {/* MESSAGE */}

                {message && (
                    <div className="mb-6 rounded-2xl border border-white/10 bg-white/4 p-4 text-sm text-zinc-300 backdrop-blur-xl">
                        {message}
                    </div>
                )}

                {/* STATS */}

                <section className="nkrn-stats mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <div
                        className={`${glassCard} p-5`}
                    >
                        <p className="text-xs font-medium uppercase tracking-[0.18em] text-zinc-500">
                            Total Requests
                        </p>

                        <p className="mt-3 text-4xl font-semibold">
                            {totalRequests}
                        </p>

                        <p className="mt-1 text-sm text-zinc-500">
                            All helpdesk requests
                        </p>
                    </div>

                    <div
                        className={`${glassCard} p-5`}
                    >
                        <p className="text-xs font-medium uppercase tracking-[0.18em] text-zinc-500">
                            Logged
                        </p>

                        <p className="mt-3 text-4xl font-semibold text-red-300">
                            {loggedRequests}
                        </p>

                        <p className="mt-1 text-sm text-zinc-500">
                            Awaiting attention
                        </p>
                    </div>

                    <div
                        className={`${glassCard} p-5`}
                    >
                        <p className="text-xs font-medium uppercase tracking-[0.18em] text-zinc-500">
                            In Progress
                        </p>

                        <p className="mt-3 text-4xl font-semibold text-orange-300">
                            {busyRequests}
                        </p>

                        <p className="mt-1 text-sm text-zinc-500">
                            Currently being handled
                        </p>
                    </div>

                    <div
                        className={`${glassCard} p-5`}
                    >
                        <p className="text-xs font-medium uppercase tracking-[0.18em] text-zinc-500">
                            Completed
                        </p>

                        <p className="mt-3 text-4xl font-semibold text-green-300">
                            {completedRequests}
                        </p>

                        <p className="mt-1 text-sm text-zinc-500">
                            Resolved requests
                        </p>
                    </div>
                </section>

                {/* MAIN DASHBOARD */}

                <section
                    className={`${glassCard} nkrn-tech-queue overflow-hidden`}
                >
                    {/* TOOLBAR */}

                    <div className="border-b border-white/10 p-5 sm:p-6">
                        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                            <div>
                                <p className="mb-1 text-xs font-medium uppercase tracking-[0.2em] text-zinc-500">
                                    Helpdesk
                                </p>

                                <h2 className="text-2xl font-semibold">
                                    Support Requests
                                </h2>

                                <p className="mt-1 text-sm text-zinc-500">
                                    Select a request to view,
                                    assign and update it.
                                </p>
                            </div>

                            <div className="flex flex-wrap gap-2">
                                <button
                                    type="button"
                                    onClick={() =>
                                        void loadDashboard()
                                    }
                                    className="rounded-xl border border-white/10 bg-white/6 px-4 py-2.5 text-sm font-medium text-zinc-200 transition hover:bg-white/10"
                                >
                                    Refresh
                                </button>

                                <button
                                    type="button"
                                    onClick={exportCSV}
                                    className="rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-zinc-200"
                                >
                                    Export CSV
                                </button>
                            </div>
                        </div>

                        {/* FILTERS */}

                        <div className="mt-6 grid gap-3 lg:grid-cols-[1fr_180px_180px]">
                            <input
                                value={search}
                                onChange={(e) =>
                                    setSearch(
                                        e.target.value
                                    )
                                }
                                placeholder="Search requests..."
                                className={inputClass}
                            />

                            <select
                                value={statusFilter}
                                onChange={(e) =>
                                    setStatusFilter(
                                        e.target.value
                                    )
                                }
                                className={selectClass}
                            >
                                <option value="All">
                                    All statuses
                                </option>

                                <option value="1">
                                    Logged
                                </option>

                                <option value="2">
                                    Busy
                                </option>

                                <option value="3">
                                    Done
                                </option>
                            </select>

                            <select
                                value={priorityFilter}
                                onChange={(e) =>
                                    setPriorityFilter(
                                        e.target.value
                                    )
                                }
                                className={selectClass}
                            >
                                <option value="All">
                                    All priorities
                                </option>

                                <option value="Critical">
                                    Critical
                                </option>

                                <option value="High">
                                    High
                                </option>

                                <option value="Medium">
                                    Medium
                                </option>

                                <option value="Low">
                                    Low
                                </option>
                            </select>
                        </div>
                    </div>

                    {/* REQUEST TABLE */}

                    <div className="overflow-x-auto">
                        <table className="w-full min-w-225 text-left">
                            <thead className="border-b border-white/10 bg-black/20">
                                <tr>
                                    <th className="px-5 py-4 text-xs font-medium uppercase tracking-wide text-zinc-500">
                                        Request
                                    </th>

                                    <th className="px-5 py-4 text-xs font-medium uppercase tracking-wide text-zinc-500">
                                        Category
                                    </th>

                                    <th className="px-5 py-4 text-xs font-medium uppercase tracking-wide text-zinc-500">
                                        Priority
                                    </th>

                                    <th className="px-5 py-4 text-xs font-medium uppercase tracking-wide text-zinc-500">
                                        Status
                                    </th>

                                    <th className="px-5 py-4 text-xs font-medium uppercase tracking-wide text-zinc-500">
                                        Assigned To
                                    </th>

                                    <th className="px-5 py-4 text-xs font-medium uppercase tracking-wide text-zinc-500">
                                        Created
                                    </th>
                                </tr>
                            </thead>

                            <tbody>
                                {filteredRequests.length ===
                                0 ? (
                                    <tr>
                                        <td
                                            colSpan={6}
                                            className="px-5 py-12 text-center text-sm text-zinc-500"
                                        >
                                            No requests match
                                            the current filters.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredRequests.map(
                                        (request) => (
                                            <tr
                                                key={
                                                    request.requestID
                                                }
                                                onClick={() =>
                                                    void selectRequest(
                                                        request
                                                    )
                                                }
                                                className={`cursor-pointer border-b border-white/6 transition hover:bg-white/4 ${
                                                    selectedRequest?.requestID ===
                                                    request.requestID
                                                        ? "bg-white/6"
                                                        : ""
                                                }`}
                                            >
                                                <td className="px-5 py-4">
                                                    <div className="flex items-start gap-3">
                                                        <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/4 text-xs text-zinc-400">
                                                            #
                                                            {
                                                                request.requestID
                                                            }
                                                        </div>

                                                        <div className="min-w-0">
                                                            <p className="font-medium text-white">
                                                                {
                                                                    request.title
                                                                }
                                                            </p>

                                                            <p className="mt-1 max-w-87.5 truncate text-xs text-zinc-500">
                                                                {
                                                                    request.description
                                                                }
                                                            </p>
                                                        </div>
                                                    </div>
                                                </td>

                                                <td className="px-5 py-4 text-sm text-zinc-400">
                                                    {getCategoryName(
                                                        request.categoryID
                                                    )}
                                                </td>

                                                <td className="px-5 py-4">
                                                    <span
                                                        className={`rounded-full border px-3 py-1 text-xs font-medium ${getPriorityClass(
                                                            request.priority
                                                        )}`}
                                                    >
                                                        {
                                                            request.priority
                                                        }
                                                    </span>
                                                </td>

                                                <td className="px-5 py-4">
                                                    <span
                                                        className={`rounded-full border px-3 py-1 text-xs font-medium ${getStatusClass(
                                                            request.statusID
                                                        )}`}
                                                    >
                                                        {getStatusLabel(
                                                            request.statusID
                                                        )}
                                                    </span>
                                                </td>

                                                <td className="px-5 py-4 text-sm text-zinc-400">
                                                    {getTechnicianName(
                                                        request.assignedTo
                                                    )}
                                                </td>

                                                <td className="px-5 py-4 text-xs text-zinc-500">
                                                    {formatDate(
                                                        request.createdDate
                                                    )}
                                                </td>
                                            </tr>
                                        )
                                    )
                                )}
                            </tbody>
                        </table>
                    </div>
                </section>

                {/* SELECTED REQUEST */}

                {selectedRequest && (
                    <section
                        className={`${glassCard} nkrn-request-detail mt-8 p-5 sm:p-7`}
                    >
                        <div className="flex flex-col gap-6 xl:flex-row">
                            {/* REQUEST DETAILS */}

                            <div className="min-w-0 flex-1">
                                <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                                    <div>
                                        <p className="mb-2 text-xs font-medium uppercase tracking-[0.2em] text-zinc-500">
                                            Request #
                                            {
                                                selectedRequest.requestID
                                            }
                                        </p>

                                        <h2 className="text-2xl font-semibold">
                                            {
                                                selectedRequest.title
                                            }
                                        </h2>

                                        <p className="mt-2 text-sm text-zinc-500">
                                            Submitted{" "}
                                            {formatDate(
                                                selectedRequest.createdDate
                                            )}
                                        </p>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() =>
                                            setSelectedRequest(
                                                null
                                            )
                                        }
                                        className="rounded-xl border border-white/10 bg-white/4 px-4 py-2.5 text-sm text-zinc-400 transition hover:bg-white/8 hover:text-white"
                                    >
                                        Close
                                    </button>
                                </div>

                                <div className="mb-6 rounded-2xl border border-white/10 bg-black/20 p-5">
                                    <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
                                        Description
                                    </p>

                                    <p className="whitespace-pre-wrap text-sm leading-7 text-zinc-300">
                                        {
                                            selectedRequest.description
                                        }
                                    </p>
                                </div>

                                <div className="grid gap-4 sm:grid-cols-2">
                                    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                                        <p className="text-xs text-zinc-500">
                                            Category
                                        </p>

                                        <p className="mt-1 text-sm font-medium text-white">
                                            {getCategoryName(
                                                selectedRequest.categoryID
                                            )}
                                        </p>
                                    </div>

                                    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                                        <p className="text-xs text-zinc-500">
                                            Currently Assigned To
                                        </p>

                                        <p className="mt-1 text-sm font-medium text-white">
                                            {getTechnicianName(
                                                selectedRequest.assignedTo
                                            )}
                                        </p>
                                    </div>
                                </div>

                                {/* COMMENTS */}

                                <div className="mt-6">
                                    <p className="mb-4 text-xs font-medium uppercase tracking-[0.2em] text-zinc-500">
                                        Internal Comments
                                    </p>

                                    <div className="space-y-3">
                                        {commentsLoading ? (
                                            <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-zinc-500">
                                                Loading comments...
                                            </div>
                                        ) : comments.length ===
                                          0 ? (
                                            <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-zinc-500">
                                                No comments yet.
                                            </div>
                                        ) : (
                                            comments.map(
                                                (
                                                    comment
                                                ) => (
                                                    <div
                                                        key={
                                                            comment.commentID
                                                        }
                                                        className="rounded-2xl border border-white/10 bg-black/20 p-4"
                                                    >
                                                        <div className="flex items-center justify-between gap-3">
                                                            <p className="text-sm font-medium text-zinc-200">
                                                                {comment.user
                                                                    ? `${comment.user.firstName} ${comment.user.lastName}`
                                                                    : `User #${comment.userID}`}
                                                            </p>

                                                            <p className="text-xs text-zinc-600">
                                                                {formatDate(
                                                                    comment.createdDate
                                                                )}
                                                            </p>
                                                        </div>

                                                        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-zinc-400">
                                                            {
                                                                comment.comment
                                                            }
                                                        </p>
                                                    </div>
                                                )
                                            )
                                        )}
                                    </div>

                                    <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                                        <input
                                            value={
                                                newComment
                                            }
                                            onChange={(e) =>
                                                setNewComment(
                                                    e.target.value
                                                )
                                            }
                                            onKeyDown={(e) => {
                                                if (
                                                    e.key ===
                                                    "Enter"
                                                ) {
                                                    e.preventDefault();

                                                    void addComment();
                                                }
                                            }}
                                            placeholder="Add an internal comment..."
                                            className={inputClass}
                                        />

                                        <button
                                            type="button"
                                            onClick={() =>
                                                void addComment()
                                            }
                                            className="rounded-xl bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-zinc-200"
                                        >
                                            Add Comment
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* MANAGEMENT PANEL */}

                            <aside className="w-full xl:w-90">
                                <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
                                    <p className="mb-5 text-xs font-medium uppercase tracking-[0.2em] text-zinc-500">
                                        Manage Request
                                    </p>

                                    <div className="space-y-5">
                                        <div>
                                            <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-zinc-500">
                                                {user.roleID === 3
                                                    ? "Assign to"
                                                    : "Technician"}
                                            </label>

                                            <select
                                                value={
                                                    editAssignedTo ??
                                                    ""
                                                }
                                                onChange={(e) =>
                                                    setEditAssignedTo(
                                                        e.target
                                                            .value
                                                            ? Number(
                                                                  e
                                                                      .target
                                                                      .value
                                                              )
                                                            : null
                                                    )
                                                }
                                                className={
                                                    selectClass
                                                }
                                            >
                                                <option value="">
                                                    Unassigned
                                                </option>

                                                {technicians.map(
                                                    (
                                                        technician
                                                    ) => (
                                                        <option
                                                            key={
                                                                technician.userID
                                                            }
                                                            value={
                                                                technician.userID
                                                            }
                                                        >
                                                            {
                                                                technician.firstName
                                                            }{" "}
                                                            {
                                                                technician.lastName
                                                            }{" "}
                                                            {user.roleID ===
                                                                3 &&
                                                            technician.roleID ===
                                                                3
                                                                ? "(Admin)"
                                                                : ""}
                                                        </option>
                                                    )
                                                )}
                                            </select>
                                        </div>

                                        <div>
                                            <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-zinc-500">
                                                Status
                                            </label>

                                            <select
                                                value={
                                                    editStatusID
                                                }
                                                onChange={(e) =>
                                                    setEditStatusID(
                                                        Number(
                                                            e.target
                                                                .value
                                                        )
                                                    )
                                                }
                                                className={
                                                    selectClass
                                                }
                                            >
                                                <option value={1}>
                                                    Logged
                                                </option>

                                                <option value={2}>
                                                    Busy
                                                </option>

                                                <option value={3}>
                                                    Done
                                                </option>
                                            </select>
                                        </div>

                                        <div>
                                            <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-zinc-500">
                                                Priority
                                            </label>

                                            <select
                                                value={
                                                    editPriority
                                                }
                                                onChange={(e) =>
                                                    setEditPriority(
                                                        e.target
                                                            .value
                                                    )
                                                }
                                                className={
                                                    selectClass
                                                }
                                            >
                                                <option value="Low">
                                                    Low
                                                </option>

                                                <option value="Medium">
                                                    Medium
                                                </option>

                                                <option value="High">
                                                    High
                                                </option>

                                                <option value="Critical">
                                                    Critical
                                                </option>
                                            </select>
                                        </div>

                                        <button
                                            type="button"
                                            onClick={() =>
                                                void saveRequest()
                                            }
                                            disabled={saving}
                                            className="w-full rounded-xl bg-white p-3.5 text-sm font-semibold text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
                                        >
                                            {saving
                                                ? "Saving..."
                                                : "Save Changes"}
                                        </button>
                                    </div>
                                </div>

                                {/* QUICK STATUS */}

                                <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-5">
                                    <p className="mb-4 text-xs font-medium uppercase tracking-[0.2em] text-zinc-500">
                                        Quick Actions
                                    </p>

                                    <div className="grid grid-cols-2 gap-2">
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setEditStatusID(
                                                    1
                                                )
                                            }
                                            className="rounded-xl border border-red-400/10 bg-red-500/8 px-3 py-2.5 text-xs font-medium text-red-300 transition hover:bg-red-500/14"
                                        >
                                            Logged
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() =>
                                                setEditStatusID(
                                                    2
                                                )
                                            }
                                            className="rounded-xl border border-orange-400/10 bg-orange-500/8 px-3 py-2.5 text-xs font-medium text-orange-300 transition hover:bg-orange-500/14"
                                        >
                                            Busy
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() =>
                                                setEditStatusID(
                                                    3
                                                )
                                            }
                                            className="col-span-2 rounded-xl border border-green-400/10 bg-green-500/8 px-3 py-2.5 text-xs font-medium text-green-300 transition hover:bg-green-500/14"
                                        >
                                            Mark Done
                                        </button>
                                    </div>
                                </div>
                            </aside>
                        </div>
                    </section>
                )}

                {/* FOOTER */}

                <footer className="mt-10 border-t border-white/10 pt-6">
                    <p className="text-center text-sm text-zinc-600">
                        Laerskool Tygerpoort · IT Desk
                    </p>
                </footer>
            </div>
        </main>
    );
}
