"use client";

import { itLabel } from "../it-labels";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import {
    createRequest,
    getUserRequests,
    getCategories,
    getRequesters,
    RequestSubmissionError,
    type RequesterOption,
} from "@/services/requestService";

import { RequestModel } from "@/types/request";
import ItAiAssistant from "../components/ItAiAssistant";

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
    const [requestSearch, setRequestSearch] = useState("");
    const [requestStatus, setRequestStatus] = useState("all");
    const [showAllRequests, setShowAllRequests] = useState(false);
    const [categories, setCategories] = useState<Category[]>([]);

    // ========================================
    // FORM
    // ========================================

    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [aiSessionID, setAiSessionID] = useState<string | null>(null);
    const [priority, setPriority] = useState("Medium");
    const [categoryID, setCategoryID] = useState("");
    const [requestedForUserID, setRequestedForUserID] = useState("");
    const [requesters, setRequesters] = useState<RequesterOption[]>([]);
    const [loadingRequesters, setLoadingRequesters] = useState(false);
    const [requesterError, setRequesterError] = useState("");

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
    // LOAD REQUESTER OPTIONS FOR ADMINS ONLY
    // ========================================

    useEffect(() => {
        if (user?.roleID !== 3) return;
        let cancelled = false;

        async function loadRequesters() {
            setLoadingRequesters(true);
            setRequesterError("");
            try {
                const options = await getRequesters();
                if (!cancelled) setRequesters(options);
            } catch {
                if (!cancelled) {
                    setRequesterError(itLabel("Unable to load requesters. Refresh the page to try again."));
                }
            } finally {
                if (!cancelled) setLoadingRequesters(false);
            }
        }

        void loadRequesters();
        return () => { cancelled = true; };
    }, [user]);

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
                        "Jou versoeke kon nie gelaai word nie."
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
                        "Die versoekkategorieë kon nie gelaai word nie."
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
                "Kies ’n kategorie voordat jy die versoek indien."
            );
            return;
        }

        const selectedRequester = user.roleID === 3 && requestedForUserID
            ? requesters.find((person) => person.userID === Number(requestedForUserID))
            : undefined;

        if (user.roleID === 3 && requestedForUserID && !selectedRequester) {
            setMessage(itLabel("Please select an active requester."));
            return;
        }

        setLoading(true);
        setMessage("");

        try {
            const createdRequest = await createRequest({
                ...(selectedRequester ? { requestedForUserID: selectedRequester.userID } : {}),
                title: title || undefined,
                description,
                useAi: true,
                aiSessionID,

                // Technicians/Admins can choose priority.
                // Teachers receive the default Medium value.
                priority: canManageDetails
                    ? priority
                    : "Medium",

                // Technicians/Admins choose category.
                // Teachers submit 0 because they do not
                // select a category.
                categoryID: canManageDetails
                    ? Number(categoryID)
                    : 0,

            });

            setMessage(
                selectedRequester
                    ? `${itLabel("Request submitted for")} ${selectedRequester.firstName} ${selectedRequester.lastName}. #${createdRequest.requestID}`
                    : `${itLabel("Request submitted successfully.")} #${createdRequest.requestID}`
            );

            setTitle("");
            setDescription("");
            setAiSessionID(null);
            setRequestedForUserID("");

            if (canManageDetails) {
                setPriority("Medium");
            }

            // Ownership determines whose history includes the new request.
            // Avoid reporting a saved request as failed if a history refresh fails.
            if (createdRequest.userID === user.userID) {
                setRequests((current) => [createdRequest, ...current]);
            }
        } catch (error) {
            console.error(
                "Unable to submit request:",
                error
            );

            setMessage(
                error instanceof RequestSubmissionError && error.status === 403
                    ? itLabel("Only admins may log requests for another person.")
                    : error instanceof RequestSubmissionError && error.status === 400 && selectedRequester
                        ? itLabel("Check the request details and select an active requester with a valid email address.")
                        : itLabel("Die versoek kon nie ingedien word nie. Probeer asseblief weer.")
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
                return itLabel("Logged");

            case 2:
                return itLabel("Busy");

            case 3:
                return itLabel("Done");

            default:
                return "Onbekend";
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
            return "Wag op IT-ondersteuning";
        }

        const category = categories.find(
            (item) =>
                item.categoryID === requestCategoryID
        );

        return category?.categoryName ?? "Pending IT Desk";
    }

    const filteredRequests = requests.filter((request) => {
        const query = requestSearch.trim().toLocaleLowerCase();
        const matchesSearch = !query || [
            request.requestID,
            request.title,
            request.description,
            request.priority,
            getStatusLabel(request.statusID),
            getCategoryName(request.categoryID),
        ].some((value) => String(value ?? "").toLocaleLowerCase().includes(query));
        const matchesStatus = requestStatus === "all" || String(request.statusID) === requestStatus;
        return matchesSearch && matchesStatus;
    });
    const visibleRequests = showAllRequests ? filteredRequests : filteredRequests.slice(0, 5);

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
                        Jou rekening laai…
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
                                    alt="Laerskool Tygerpoort-logo"
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
                                    IT-versoek
                                </h1>

                                <p className="mt-1 text-sm text-zinc-400">
                                    Welkom {user.firstName}. Vertel ons waarmee die IT-span kan help.
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
                                    Tegnikusportaal
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
                                    Administrasie
                                </button>
                            )}

                            <button
                                type="button"
                                onClick={() => router.push("/")}
                                className="rounded-xl border border-[#d7a31f]/25 bg-[#d7a31f]/8 px-4 py-2.5 text-sm font-medium text-[#e7b42b] transition hover:border-[#d7a31f]/40 hover:bg-[#d7a31f]/12"
                            >
                                Tuis
                            </button>

                            <button
                                type="button"
                                onClick={logout}
                                className="rounded-xl border border-red-400/10 bg-red-500/8 px-4 py-2.5 text-sm font-medium text-red-300 transition hover:bg-red-500/14"
                            >
                                Meld af
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
                            IT-ondersteuning
                        </p>

                        <h2 className="text-2xl font-semibold">
                            Dien ’n versoek in
                        </h2>

                        <p className="mt-1 text-sm text-zinc-500">
                            Vertel die IT-span waarmee jy hulp benodig.
                        </p>
                    </div>

                    <form
                        data-nkrn-it-request
                        onSubmit={submitRequest}
                        className="space-y-5"
                    >

                        {user.roleID === 3 && (
                            <div>
                                <label htmlFor="requested-for" className="mb-2 block text-xs font-medium uppercase tracking-wide text-zinc-500">
                                    {itLabel("Request for")}
                                </label>
                                <select
                                    id="requested-for"
                                    className={selectClass}
                                    value={requestedForUserID}
                                    disabled={loading || loadingRequesters || Boolean(requesterError)}
                                    onChange={(event) => setRequestedForUserID(event.target.value)}
                                    aria-describedby="requested-for-help"
                                >
                                    <option value="">{itLabel("Myself")} — {user.firstName} {user.lastName}</option>
                                    {requesters.filter((person) => person.userID !== user.userID).map((person) => (
                                        <option key={person.userID} value={person.userID}>
                                            {person.lastName}, {person.firstName} — {person.email}
                                        </option>
                                    ))}
                                </select>
                                <p id="requested-for-help" className="mt-2 text-xs text-zinc-400">
                                    {loadingRequesters
                                        ? itLabel("Loading requesters...")
                                        : itLabel("The selected person will receive request emails and see the request in their history. You remain recorded as the person who logged it.")}
                                </p>
                                {requesterError && <p role="alert" className="mt-2 text-sm text-red-400">{requesterError}</p>}
                            </div>
                        )}

                        {/* NKRN AI generates the internal request title from the description. */}

                        {/* ========================================
                            DESCRIPTION
                        ======================================== */}

                        <div>
                            <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-zinc-500">
                                Beskryf die probleem
                            </label>

                            <textarea
                                required
                                value={description}
                                onChange={(e) =>
                                    setDescription(
                                        e.target.value
                                    )
                                }
                                placeholder="Beskryf wat gebeur. Jy kan ook ’n voorgestelde sperdatum of ander belangrike inligting hier byvoeg."
                                rows={6}
                                className={`${inputClass} resize-none`}
                            />

                            <p className="mt-2 text-xs text-zinc-600">
                                Jy kan ’n voorkeurdatum, sperdatum of ander belangrike inligting by die beskrywing insluit.
                            </p>
                        </div>

                        <ItAiAssistant
                            description={description}
                            disabled={loading}
                            onSuggestedTitle={setTitle}
                            onSessionStarted={setAiSessionID}
                            onResolved={() => {
                                setDescription("");
                                setTitle("");
                                setAiSessionID(null);
                                setMessage("Goed, geen IT-versoek is nodig nie.");
                            }}
                            onLogRequest={() => {
                                const form =
                                    document.querySelector<HTMLFormElement>(
                                        "form[data-nkrn-it-request]"
                                    );
                                form?.requestSubmit();
                            }}
                        />

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
                                            Kategorie
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
                                                    Kategorieë laai…
                                                </option>
                                            ) : categories.length ===
                                              0 ? (
                                                <option value="">
                                                    Geen kategorieë beskikbaar nie
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
                                                                itLabel(category.categoryName)
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
                                            Prioriteit
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
                                                Laag
                                            </option>

                                            <option value="Medium">
                                                Medium
                                            </option>

                                            <option value="High">
                                                Hoog
                                            </option>

                                            <option value="Critical">
                                                Kritiek
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
                                ? "Besig om in te dien…"
                                : "Dien versoek in"}
                        </button>
                    </form>
                </section>

                {/* ========================================
                    MY REQUESTS
                ======================================== */}

                <section className={`${glassCard} nkrn-request-history p-5 sm:p-7`}>
                    <div className="mb-6">
                        <p className="mb-1 text-xs font-medium uppercase tracking-[0.2em] text-zinc-500">
                            Geskiedenis
                        </p>

                        <h2 className="text-2xl font-semibold">
                            My versoeke
                        </h2>

                        <p className="mt-1 text-sm text-zinc-500">
                            Volg die status van jou ingediende versoeke.
                        </p>
                    </div>

                    {requests.length > 0 && (
                        <div className="mb-5 grid gap-3 md:grid-cols-[minmax(0,1fr)_200px]">
                            <label className="block">
                                <span className="mb-2 block text-xs font-medium text-zinc-500">{itLabel("Search requests...")}</span>
                                <input
                                    type="search"
                                    value={requestSearch}
                                    onChange={(event) => { setRequestSearch(event.target.value); setShowAllRequests(false); }}
                                    placeholder={itLabel("Search requests...")}
                                    className="nkrn-input w-full"
                                    aria-label={itLabel("Search requests...")}
                                />
                            </label>
                            <label className="block">
                                <span className="mb-2 block text-xs font-medium text-zinc-500">{itLabel("Status")}</span>
                                <select
                                    value={requestStatus}
                                    onChange={(event) => { setRequestStatus(event.target.value); setShowAllRequests(false); }}
                                    className="nkrn-select w-full"
                                    aria-label={itLabel("Filter requests by status")}
                                >
                                    <option value="all">{itLabel("All statuses")}</option>
                                    <option value="1">{getStatusLabel(1)}</option>
                                    <option value="2">{getStatusLabel(2)}</option>
                                    <option value="3">{getStatusLabel(3)}</option>
                                </select>
                            </label>
                        </div>
                    )}
                    {requests.length === 0 ? (
                        <div className="rounded-2xl border border-white/10 bg-black/20 p-8 text-center text-sm text-zinc-500">
                            Nog geen versoeke aangemeld nie.
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-zinc-500">
                                <span>{itLabel("Showing")} {visibleRequests.length} {itLabel("of")} {filteredRequests.length} {itLabel("matching requests")}</span>
                                {filteredRequests.length > 5 && (
                                    <button type="button" className="rounded-lg border border-white/15 px-3 py-2 text-sm" onClick={() => setShowAllRequests((value) => !value)}>
                                        {showAllRequests ? itLabel("Show fewer") : itLabel("Show all matching requests")}
                                    </button>
                                )}
                            </div>
                            {visibleRequests.length === 0 ? (
                                <div className="rounded-xl border border-white/10 p-6 text-center text-sm text-zinc-500">{itLabel("No requests match the current filters.")}</div>
                            ) : visibleRequests.map(
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
                                                {request.createdByUserID && request.createdByUserID !== request.userID && (
                                                    <p className="mt-2 text-xs text-zinc-400">
                                                        {itLabel("Logged by")}: {request.createdByName || `#${request.createdByUserID}`}
                                                    </p>
                                                )}
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
                                                        itLabel(request.priority)
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
                        Laerskool Tygerpoort · IT Report
                    </p>
                </footer>
            </div>
        </main>
    );
}
