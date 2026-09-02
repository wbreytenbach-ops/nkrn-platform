"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import {
    createRequest,
    getUserRequests,
    getCategories,
} from "@/services/requestService";

import { RequestModel } from "@/types/request";

import "../nkrn-control.css";

// ========================================
// TYPES
// ========================================

interface User {
    userID: number;
    firstName: string;
    lastName: string;
    email: string;
    roleID: number;
}

interface Category {
    categoryID: number;
    categoryName: string;
}

// ========================================
// REUSABLE STYLES
// ========================================

const inputClass = "nkrn-input";

const selectClass = "nkrn-select";

const glassCard = "nkrn-panel";

// ========================================
// PAGE
// ========================================

export default function RequestsPage() {
    const router = useRouter();

    // ========================================
    // USER
    // ========================================

    const [user, setUser] = useState<User | null>(null);
    const [checkingUser, setCheckingUser] = useState(true);

    // ========================================
    // DATA
    // ========================================

    const [requests, setRequests] = useState<RequestModel[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);

    // ========================================
    // FORM
    // ========================================

    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [priority, setPriority] = useState("Medium");
    const [categoryID, setCategoryID] = useState("");

    // ========================================
    // UI
    // ========================================

    const [message, setMessage] = useState("");
    const [loading, setLoading] = useState(false);
    const [loadingCategories, setLoadingCategories] = useState(false);

    // ========================================
    // ROLE HELPERS
    // ========================================

    function canManageRequestDetails(
        currentUser: User
    ): boolean {
        return (
            currentUser.roleID === 2 ||
            currentUser.roleID === 3
        );
    }

    // ========================================
    // LOGIN CHECK
    // ========================================

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
                setCheckingUser(false);
                router.replace("/login");
                return;
            }

            try {
                const parsedUser = JSON.parse(
                    storedUser
                ) as User;

                if (!cancelled) {
                    setUser(parsedUser);
                }
            } catch (error) {
                console.error(
                    "Unable to restore logged-in user.",
                    error
                );

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

    // ========================================
    // LOAD USER REQUESTS
    // ========================================

    useEffect(() => {
        if (!user) {
            return;
        }

        const userID = user.userID;

        let cancelled = false;

        async function loadUserRequests() {
            try {
                const userRequests =
                    await getUserRequests(userID);

                if (cancelled) {
                    return;
                }

                setRequests(userRequests);
            } catch (error) {
                console.error(
                    "Failed loading user requests.",
                    error
                );

                if (!cancelled) {
                    setMessage(
                        "Unable to load your requests."
                    );
                }
            }
        }

        void loadUserRequests();

        return () => {
            cancelled = true;
        };
    }, [user]);

    // ========================================
    // LOAD CATEGORIES
    //
    // Categories are only needed by
    // technicians and administrators.
    // ========================================

    useEffect(() => {
        if (!user || !canManageRequestDetails(user)) {
            return;
        }

        let cancelled = false;

        async function loadCategories() {
            setLoadingCategories(true);

            try {
                const availableCategories =
                    await getCategories();

                if (cancelled) {
                    return;
                }

                setCategories(availableCategories);

                if (availableCategories.length > 0) {
                    setCategoryID(
                        String(
                            availableCategories[0].categoryID
                        )
                    );
                }
            } catch (error) {
                console.error(
                    "Failed loading categories.",
                    error
                );

                if (!cancelled) {
                    setMessage(
                        "Unable to load request categories."
                    );
                }
            } finally {
                if (!cancelled) {
                    setLoadingCategories(false);
                }
            }
        }

        void loadCategories();

        return () => {
            cancelled = true;
        };
    }, [user]);

    // ========================================
    // LOGOUT
    // ========================================

    function logout() {
        localStorage.removeItem("token");
        localStorage.removeItem("user");

        router.push("/login");
    }

    // ========================================
    // SUBMIT REQUEST
    // ========================================

    async function submitRequest(
        e: React.FormEvent<HTMLFormElement>
    ) {
        e.preventDefault();

        if (!user) {
            return;
        }

        const canManageDetails =
            canManageRequestDetails(user);

        // ========================================
        // CATEGORY VALIDATION
        //
        // Only technicians/admins need a category.
        // Teachers do not select one.
        // ========================================

        if (canManageDetails && !categoryID) {
            setMessage(
                "Please select a category before submitting the request."
            );
            return;
        }

        setLoading(true);
        setMessage("");

        try {
            await createRequest({
                userID: user.userID,
                title,
                description,

                // Technicians/Admins can choose priority.
                // Teachers receive the default Medium value.
                priority: canManageDetails
                    ? priority
                    : "Medium",

                assignedTo: null,
                createdDate: null,
                completedDate: null,

                // Technicians/Admins choose category.
                // Teachers submit 0 because they do not
                // select a category.
                categoryID: canManageDetails
                    ? Number(categoryID)
                    : 0,

                statusID: 1,
            });

            setMessage(
                "Request submitted successfully."
            );

            setTitle("");
            setDescription("");

            if (canManageDetails) {
                setPriority("Medium");
            }

            const updatedRequests =
                await getUserRequests(user.userID);

            setRequests(updatedRequests);
        } catch (error) {
            console.error(
                "Unable to submit request:",
                error
            );

            setMessage(
                "Something went wrong submitting your request."
            );
        } finally {
            setLoading(false);
        }
    }

    // ========================================
    // STATUS LABEL
    // ========================================

    function getStatusLabel(statusID: number): string {
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

    // ========================================
    // STATUS STYLE
    // ========================================

    function getStatusClass(statusID: number): string {
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

    // ========================================
    // CATEGORY NAME
    // ========================================

    function getCategoryName(
        requestCategoryID: number | null
    ): string {
        if (
            requestCategoryID === null ||
            requestCategoryID === 0
        ) {
            return "Pending IT Desk";
        }

        const category = categories.find(
            (item) =>
                item.categoryID === requestCategoryID
        );

        return category?.categoryName ?? "Pending IT Desk";
    }

    // ========================================
    // WAIT FOR LOGIN
    // ========================================

    if (checkingUser) {
        return (
            <main className="nkrn-control relative flex min-h-screen items-center justify-center overflow-hidden bg-zinc-950 text-white">
                <div className="pointer-events-none absolute inset-0 overflow-hidden">
                    <div className="absolute -left-40 -top-40 h-125 w-125 rounded-full bg-white/3.5 blur-3xl" />

                    <div className="absolute -right-40 top-1/4 h-150 w-150 rounded-full bg-white/2.5 blur-3xl" />
                </div>

                <div className="relative text-center">
                    <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl">
                        <div className="h-5 w-5 animate-pulse rounded-full bg-white/60" />
                    </div>

                    <p className="text-sm text-zinc-400">
                        Loading your account...
                    </p>
                </div>
            </main>
        );
    }

    if (!user) {
        return null;
    }

    const showCategorySelector =
        canManageRequestDetails(user);

    const showPrioritySelector =
        canManageRequestDetails(user);

    // ========================================
    // PAGE
    // ========================================

    return (
        <main className="nkrn-control relative min-h-screen overflow-hidden bg-zinc-950 text-white">

            {/* ========================================
                BACKGROUND
            ======================================== */}

            <div className="pointer-events-none fixed inset-0 overflow-hidden">
                <div className="absolute -left-40 -top-40 h-125 w-125 rounded-full bg-white/3.5 blur-3xl" />

                <div className="absolute -right-40 top-1/4 h-150 w-150 rounded-full bg-white/2.5 blur-3xl" />

                <div className="absolute -bottom-62.5 left-1/3 h-125 w-125 rounded-full bg-white/2 blur-3xl" />
            </div>

            <div className="relative mx-auto w-full max-w-5xl px-5 py-8 sm:px-8 lg:px-10">

                {/* ========================================
                    HEADER
                ======================================== */}

                <header className={`${glassCard} nkrn-hero mb-8 p-5 sm:p-7`}>
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
                                    IT Request
                                </h1>

                                <p className="mt-1 text-sm text-zinc-400">
                                    Welcome {user.firstName}. Submit a technical support request.
                                </p>
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-2">

                            {(user.roleID === 2 ||
                                user.roleID === 3) && (
                                <button
                                    type="button"
                                    onClick={() =>
                                        router.push("/Tech")
                                    }
                                    className="rounded-xl border border-white/10 bg-white/6 px-4 py-2.5 text-sm font-medium text-zinc-200 transition hover:bg-white/10"
                                >
                                    Tech Dashboard
                                </button>
                            )}

                            {user.roleID === 3 && (
                                <button
                                    type="button"
                                    onClick={() =>
                                        router.push("/Admin")
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

                {/* ========================================
                    MESSAGE
                ======================================== */}

                {message && (
                    <div
                        className={`mb-6 rounded-2xl border p-4 text-sm backdrop-blur-xl ${
                            message
                                .toLowerCase()
                                .includes("success")
                                ? "border-green-400/10 bg-green-500/7 text-green-300"
                                : "border-red-400/10 bg-red-500/7 text-red-300"
                        }`}
                    >
                        {message}
                    </div>
                )}

                {/* ========================================
                    REQUEST FORM
                ======================================== */}

                <section
                    className={`${glassCard} nkrn-request-form mb-8 p-5 sm:p-7`}
                >
                    <div className="mb-7">
                        <p className="mb-1 text-xs font-medium uppercase tracking-[0.2em] text-zinc-500">
                            Helpdesk
                        </p>

                        <h2 className="text-2xl font-semibold">
                            Submit a Request
                        </h2>

                        <p className="mt-1 text-sm text-zinc-500">
                            Tell the IT team what you need assistance with.
                        </p>
                    </div>

                    <form
                        onSubmit={submitRequest}
                        className="space-y-5"
                    >

                        {/* ========================================
                            TITLE
                        ======================================== */}

                        <div>
                            <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-zinc-500">
                                Request title
                            </label>

                            <input
                                required
                                value={title}
                                onChange={(e) =>
                                    setTitle(
                                        e.target.value
                                    )
                                }
                                placeholder="e.g. Projector not displaying"
                                className={inputClass}
                            />
                        </div>

                        {/* ========================================
                            DESCRIPTION
                        ======================================== */}

                        <div>
                            <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-zinc-500">
                                Describe the problem
                            </label>

                            <textarea
                                required
                                value={description}
                                onChange={(e) =>
                                    setDescription(
                                        e.target.value
                                    )
                                }
                                placeholder="Please describe what is happening. You may also include a suggested due date or other important information here."
                                rows={6}
                                className={`${inputClass} resize-none`}
                            />

                            <p className="mt-2 text-xs text-zinc-600">
                                You can include a preferred completion date,
                                deadline, or other important information in
                                the description.
                            </p>
                        </div>

                        {/* ========================================
                            CATEGORY + PRIORITY
                            
                            TEACHERS:
                            - No category
                            - No priority

                            TECHNICIANS / ADMINS:
                            - Category
                            - Priority
                        ======================================== */}

                        {(showCategorySelector ||
                            showPrioritySelector) && (
                            <div className="grid gap-5 md:grid-cols-2">

                                {/* CATEGORY */}

                                {showCategorySelector && (
                                    <div>
                                        <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-zinc-500">
                                            Category
                                        </label>

                                        <select
                                            required
                                            value={categoryID}
                                            onChange={(e) =>
                                                setCategoryID(
                                                    e.target.value
                                                )
                                            }
                                            disabled={
                                                loadingCategories
                                            }
                                            className={selectClass}
                                        >
                                            {loadingCategories ? (
                                                <option>
                                                    Loading categories...
                                                </option>
                                            ) : categories.length ===
                                              0 ? (
                                                <option value="">
                                                    No categories available
                                                </option>
                                            ) : (
                                                categories.map(
                                                    (
                                                        category
                                                    ) => (
                                                        <option
                                                            key={
                                                                category.categoryID
                                                            }
                                                            value={
                                                                category.categoryID
                                                            }
                                                        >
                                                            {
                                                                category.categoryName
                                                            }
                                                        </option>
                                                    )
                                                )
                                            )}
                                        </select>
                                    </div>
                                )}

                                {/* PRIORITY */}

                                {showPrioritySelector && (
                                    <div>
                                        <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-zinc-500">
                                            Priority
                                        </label>

                                        <select
                                            value={priority}
                                            onChange={(e) =>
                                                setPriority(
                                                    e.target.value
                                                )
                                            }
                                            className={selectClass}
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
                                )}
                            </div>
                        )}

                        {/* ========================================
                            TEACHER INFORMATION
                        ======================================== */}

                        {!showCategorySelector &&
                            !showPrioritySelector && (
                                <div className="rounded-2xl border border-white/10 bg-white/2.5 p-4">
                                    <p className="text-sm leading-6 text-zinc-400">
                                        Your request will be reviewed by
                                        the IT team. An administrator or
                                        technician will determine the
                                        appropriate category and priority.
                                    </p>

                                    <p className="mt-2 text-xs leading-5 text-zinc-600">
                                        If your request needs to be completed
                                        by a particular date, please mention
                                        the date in the description above.
                                    </p>
                                </div>
                            )}

                        {/* ========================================
                            SUBMIT
                        ======================================== */}

                        <button
                            type="submit"
                            disabled={
                                loading ||
                                (showCategorySelector &&
                                    loadingCategories)
                            }
                            className="w-full rounded-xl bg-white p-3.5 text-sm font-semibold text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {loading
                                ? "Submitting..."
                                : "Submit Request"}
                        </button>
                    </form>
                </section>

                {/* ========================================
                    MY REQUESTS
                ======================================== */}

                <section className={`${glassCard} nkrn-request-history p-5 sm:p-7`}>
                    <div className="mb-6">
                        <p className="mb-1 text-xs font-medium uppercase tracking-[0.2em] text-zinc-500">
                            History
                        </p>

                        <h2 className="text-2xl font-semibold">
                            My Requests
                        </h2>

                        <p className="mt-1 text-sm text-zinc-500">
                            View the status of requests you have submitted.
                        </p>
                    </div>

                    {requests.length === 0 ? (
                        <div className="rounded-2xl border border-white/10 bg-black/20 p-8 text-center text-sm text-zinc-500">
                            No requests logged yet.
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {requests.map(
                                (request) => (
                                    <div
                                        key={
                                            request.requestID
                                        }
                                        className="rounded-2xl border border-white/8 bg-black/20 p-5 transition hover:border-white/13"
                                    >
                                        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">

                                            <div className="min-w-0">
                                                <div className="mb-2 flex flex-wrap items-center gap-3">

                                                    <h3 className="text-lg font-semibold">
                                                        {
                                                            request.title
                                                        }
                                                    </h3>

                                                    <span
                                                        className={`rounded-full border px-3 py-1 text-xs font-medium ${getStatusClass(
                                                            request.statusID
                                                        )}`}
                                                    >
                                                        {getStatusLabel(
                                                            request.statusID
                                                        )}
                                                    </span>
                                                </div>

                                                <p className="whitespace-pre-wrap text-sm leading-6 text-zinc-400">
                                                    {
                                                        request.description
                                                    }
                                                </p>
                                            </div>

                                            <div className="flex shrink-0 flex-wrap gap-2 text-xs">
                                                <span className="rounded-lg border border-white/10 bg-white/4 px-3 py-2 text-zinc-400">
                                                    Request #
                                                    {
                                                        request.requestID
                                                    }
                                                </span>
                                            </div>
                                        </div>

                                        <div className="mt-5 flex flex-wrap gap-2">

                                            <span className="rounded-lg border border-white/10 bg-white/4 px-3 py-2 text-xs text-zinc-400">
                                                Category:{" "}
                                                <span className="text-zinc-200">
                                                    {getCategoryName(
                                                        request.categoryID
                                                    )}
                                                </span>
                                            </span>

                                            <span className="rounded-lg border border-white/10 bg-white/4 px-3 py-2 text-xs text-zinc-400">
                                                Priority:{" "}
                                                <span className="text-zinc-200">
                                                    {
                                                        request.priority
                                                    }
                                                </span>
                                            </span>
                                        </div>
                                    </div>
                                )
                            )}
                        </div>
                    )}
                </section>

                {/* ========================================
                    FOOTER
                ======================================== */}

                <footer className="mt-10 border-t border-white/10 pt-6">
                    <p className="text-center text-sm text-zinc-600">
                        Laerskool Tygerpoort · IT Desk
                    </p>
                </footer>
            </div>
        </main>
    );
}