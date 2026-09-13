"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import "../nkrn-control.css";

interface NKRNUser {
    userID: number;
    firstName: string;
    lastName: string;
    email: string;
    roleID: number;
}

interface LocationItem {
    locationID: number;
    locationName: string;
    locationCode: string | null;
    locationType: string;
    building: string | null;
    floorName: string | null;
    mapShapeKey: string | null;
    canBeBooked: boolean;
    isActive: boolean;
    displayOrder: number;
}

interface EquipmentType {
    equipmentTypeID: number;
    equipmentName: string;
    isActive: boolean;
    displayOrder: number;
}

interface MaintenanceType {
    maintenanceTypeID: number;
    maintenanceName: string;
    isActive: boolean;
    displayOrder: number;
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

interface VenueBooking {
    bookingID: number;
    locationID: number;
    locationName: string;
    logisticsRequestID: number | null;
    bookedByUserID: number;
    bookedByName: string;
    title: string;
    bookingDate: string;
    startTime: string;
    endTime: string;
    status: string;
    notes: string | null;
    createdDate: string;
    updatedDate: string;
}

interface ReferenceData {
    locations: LocationItem[];
    equipment: EquipmentType[];
    maintenance: MaintenanceType[];
    requestTypes: string[];
    activityCategories: string[];
}

type PortalView = "home" | "requests" | "venues" | "map";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

const glassCard =
    "nkrn-panel rounded-[28px] border border-white/10 bg-white/4 shadow-2xl shadow-black/20 backdrop-blur-2xl";

const inputClass =
    "nkrn-input w-full rounded-xl border border-white/10 bg-zinc-900/70 px-3.5 py-3 text-sm text-white placeholder:text-zinc-600 outline-none transition focus:border-[#d7a31f]/45";

const selectClass =
    "nkrn-select w-full rounded-xl border border-white/10 bg-zinc-900/70 px-3.5 py-3 text-sm text-white outline-none transition focus:border-[#d7a31f]/45";

function authHeaders(): HeadersInit {
    const token = localStorage.getItem("token");

    return {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
}

function todayISO() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function addMonthsISO(months: number) {
    const date = new Date();
    date.setMonth(date.getMonth() + months);
    return date.toISOString().slice(0, 10);
}

function displayDate(value?: string | null) {
    if (!value) return "—";

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

function shortTime(value?: string | null) {
    if (!value) return "—";
    return value.slice(0, 5);
}

function statusStyle(status: string) {
    const value = status.toLowerCase();

    if (value === "completed") {
        return "border-green-400/15 bg-green-500/10 text-green-300";
    }

    if (value === "approved" || value === "converted") {
        return "border-[#d7a31f]/25 bg-[#d7a31f]/10 text-[#e7b42b]";
    }

    if (value === "declined" || value === "cancelled") {
        return "border-red-400/15 bg-red-500/10 text-red-300";
    }

    if (value === "under review" || value === "needs information") {
        return "border-orange-400/15 bg-orange-500/10 text-orange-300";
    }

    return "border-white/10 bg-white/5 text-zinc-300";
}

function requestLocation(request: LogisticsRequest) {
    const primary = request.locations?.find((item) => item.isPrimary);
    const first = primary ?? request.locations?.[0];

    return first?.locationName || first?.locationText || "No location";
}

export default function LogisticsTeacherPortal({
    user,
}: {
    user: NKRNUser;
}) {
    const router = useRouter();

    const [view, setView] = useState<PortalView>("home");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    const [requests, setRequests] = useState<LogisticsRequest[]>([]);
    const [bookings, setBookings] = useState<VenueBooking[]>([]);
    const [referenceData, setReferenceData] = useState<ReferenceData>({
        locations: [],
        equipment: [],
        maintenance: [],
        requestTypes: [],
        activityCategories: [],
    });

    const [requestOpen, setRequestOpen] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    const [requestType, setRequestType] = useState<"Event" | "Maintenance" | "General">("Event");
    const [activityCategory, setActivityCategory] = useState("Sport");
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [activityDate, setActivityDate] = useState("");
    const [startTime, setStartTime] = useState("");
    const [endTime, setEndTime] = useState("");
    const [cleanupNextDay, setCleanupNextDay] = useState(false);
    const [locationID, setLocationID] = useState("");
    const [customLocation, setCustomLocation] = useState("");
    const [selectedEquipment, setSelectedEquipment] = useState<number[]>([]);
    const [maintenanceTypeID, setMaintenanceTypeID] = useState("");
    const [maintenanceAction, setMaintenanceAction] = useState<"Repair" | "Replace" | "Unsure">("Unsure");

    const [checkingAvailability, setCheckingAvailability] = useState(false);
    const [availabilityMessage, setAvailabilityMessage] = useState("");
    const [availabilityOkay, setAvailabilityOkay] = useState<boolean | null>(null);

    const [selectedMapLocationID, setSelectedMapLocationID] = useState<number | null>(null);

    const loadPortal = useCallback(async () => {
        try {
            setLoading(true);
            setError("");

            const [mineResponse, referenceResponse, bookingResponse] =
                await Promise.all([
                    fetch(`${API_URL}/api/LogisticsRequests/mine`, {
                        headers: authHeaders(),
                        cache: "no-store",
                    }),
                    fetch(`${API_URL}/api/LogisticsRequests/reference-data`, {
                        headers: authHeaders(),
                        cache: "no-store",
                    }),
                    fetch(
                        `${API_URL}/api/VenueBookings?fromDate=${todayISO()}&toDate=${addMonthsISO(3)}`,
                        {
                            headers: authHeaders(),
                            cache: "no-store",
                        }
                    ),
                ]);

            if (
                mineResponse.status === 401 ||
                referenceResponse.status === 401 ||
                bookingResponse.status === 401
            ) {
                localStorage.removeItem("token");
                localStorage.removeItem("user");
                router.replace("/login");
                return;
            }

            if (!mineResponse.ok) {
                throw new Error(
                    `Unable to load your Logistics requests (${mineResponse.status}).`
                );
            }

            if (!referenceResponse.ok) {
                throw new Error(
                    `Unable to load Logistics options (${referenceResponse.status}).`
                );
            }

            setRequests((await mineResponse.json()) as LogisticsRequest[]);
            setReferenceData((await referenceResponse.json()) as ReferenceData);

            if (bookingResponse.ok) {
                setBookings((await bookingResponse.json()) as VenueBooking[]);
            }
        } catch (loadError) {
            console.error("Unable to load teacher Logistics portal:", loadError);
            setError(
                loadError instanceof Error
                    ? loadError.message
                    : "Unable to load Logistics."
            );
        } finally {
            setLoading(false);
        }
    }, [router]);

    useEffect(() => {
        const timer = window.setTimeout(() => {
            void loadPortal();
        }, 0);

        return () => window.clearTimeout(timer);
    }, [loadPortal]);

    const activeRequests = useMemo(
        () =>
            requests.filter(
                (request) =>
                    !["Completed", "Declined", "Cancelled"].includes(request.status)
            ),
        [requests]
    );

    const selectedMapLocation =
        referenceData.locations.find(
            (location) => location.locationID === selectedMapLocationID
        ) ?? null;

    const selectedLocationBookings = useMemo(() => {
        if (!selectedMapLocationID) {
            return [];
        }

        return bookings.filter(
            (booking) => booking.locationID === selectedMapLocationID
        );
    }, [bookings, selectedMapLocationID]);

    function resetRequestForm() {
        setRequestType("Event");
        setActivityCategory("Sport");
        setTitle("");
        setDescription("");
        setActivityDate("");
        setStartTime("");
        setEndTime("");
        setCleanupNextDay(false);
        setLocationID("");
        setCustomLocation("");
        setSelectedEquipment([]);
        setMaintenanceTypeID("");
        setMaintenanceAction("Unsure");
        setAvailabilityMessage("");
        setAvailabilityOkay(null);
    }

    function openRequestForm(type?: "Event" | "Maintenance" | "General") {
        resetRequestForm();
        if (type) {
            setRequestType(type);
        }
        setError("");
        setSuccess("");
        setRequestOpen(true);
    }

    async function checkAvailability() {
        if (!locationID || !activityDate || !startTime || !endTime) {
            setAvailabilityOkay(null);
            setAvailabilityMessage(
                "Select a venue, date, start time and end time first."
            );
            return;
        }

        try {
            setCheckingAvailability(true);
            setAvailabilityMessage("");
            setAvailabilityOkay(null);

            const params = new URLSearchParams({
                date: activityDate,
                startTime,
                endTime,
            });

            const response = await fetch(
                `${API_URL}/api/Locations/${locationID}/availability?${params.toString()}`,
                {
                    headers: authHeaders(),
                    cache: "no-store",
                }
            );

            if (!response.ok) {
                const body = await response.text();
                throw new Error(body || "Unable to check venue availability.");
            }

            const result = (await response.json()) as {
                available: boolean;
                conflicts: VenueBooking[];
            };

            setAvailabilityOkay(result.available);

            if (result.available) {
                setAvailabilityMessage("Venue is available for this time.");
            } else {
                const conflict = result.conflicts[0];

                setAvailabilityMessage(
                    conflict
                        ? `Already booked: ${conflict.title} (${shortTime(
                              conflict.startTime
                          )}–${shortTime(conflict.endTime)}).`
                        : "This venue is already booked during the selected time."
                );
            }
        } catch (availabilityError) {
            setAvailabilityOkay(null);
            setAvailabilityMessage(
                availabilityError instanceof Error
                    ? availabilityError.message
                    : "Unable to check venue availability."
            );
        } finally {
            setCheckingAvailability(false);
        }
    }

    async function submitRequest() {
        if (!title.trim()) {
            setError("Please enter a short request title.");
            return;
        }

        if (requestType === "Event") {
            if (!activityDate || !startTime || !endTime) {
                setError("Event date, start time and end time are required.");
                return;
            }

            if (endTime <= startTime) {
                setError("The event end time must be after the start time.");
                return;
            }
        }

        if (
            requestType === "Maintenance" &&
            !maintenanceTypeID
        ) {
            setError("Please select what needs attention.");
            return;
        }

        try {
            setSubmitting(true);
            setError("");
            setSuccess("");

            const locations =
                locationID || customLocation.trim()
                    ? [
                          {
                              locationID: locationID
                                  ? Number(locationID)
                                  : null,
                              locationText: customLocation.trim() || null,
                              isPrimary: true,
                          },
                      ]
                    : [];

            const equipment = selectedEquipment.map((equipmentTypeID) => ({
                equipmentTypeID,
                quantity: null,
                notes: null,
            }));

            const maintenanceItems =
                requestType === "Maintenance" && maintenanceTypeID
                    ? [
                          {
                              maintenanceTypeID: Number(maintenanceTypeID),
                              actionType: maintenanceAction,
                              notes: null,
                          },
                      ]
                    : [];

            const response = await fetch(`${API_URL}/api/LogisticsRequests`, {
                method: "POST",
                headers: authHeaders(),
                body: JSON.stringify({
                    requestType,
                    activityCategory:
                        requestType === "Event" ? activityCategory : null,
                    title: title.trim(),
                    description: description.trim() || null,
                    activityDate:
                        requestType === "Event" ? activityDate : null,
                    startTime:
                        requestType === "Event" ? startTime : null,
                    endTime:
                        requestType === "Event" ? endTime : null,
                    cleanupNextDay:
                        requestType === "Event" ? cleanupNextDay : null,
                    locations,
                    equipment,
                    maintenanceItems,
                }),
            });

            if (response.status === 401) {
                localStorage.removeItem("token");
                localStorage.removeItem("user");
                router.replace("/login");
                return;
            }

            if (!response.ok) {
                let message = "Unable to submit this Logistics request.";

                try {
                    const body = (await response.json()) as {
                        message?: string;
                        title?: string;
                    };

                    message = body.message || body.title || message;
                } catch {
                    // Keep friendly fallback.
                }

                throw new Error(message);
            }

            const created = (await response.json()) as LogisticsRequest;

            setRequestOpen(false);
            resetRequestForm();
            setSuccess(
                `Request #${created.requestID} was submitted to the Logistics team.`
            );

            await loadPortal();
            setView("requests");
        } catch (submitError) {
            console.error("Unable to submit Logistics request:", submitError);
            setError(
                submitError instanceof Error
                    ? submitError.message
                    : "Unable to submit this Logistics request."
            );
        } finally {
            setSubmitting(false);
        }
    }

    async function cancelRequest(request: LogisticsRequest) {
        if (
            !window.confirm(
                `Cancel Logistics Request #${request.requestID}?`
            )
        ) {
            return;
        }

        try {
            setError("");
            setSuccess("");

            const response = await fetch(
                `${API_URL}/api/LogisticsRequests/${request.requestID}/cancel`,
                {
                    method: "POST",
                    headers: authHeaders(),
                }
            );

            if (!response.ok) {
                let message = "Unable to cancel this request.";

                try {
                    const body = (await response.json()) as {
                        message?: string;
                    };
                    message = body.message || message;
                } catch {
                    // Keep fallback.
                }

                throw new Error(message);
            }

            setSuccess(`Request #${request.requestID} was cancelled.`);
            await loadPortal();
        } catch (cancelError) {
            setError(
                cancelError instanceof Error
                    ? cancelError.message
                    : "Unable to cancel this request."
            );
        }
    }

    function logout() {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        router.replace("/login");
    }

    if (loading) {
        return (
            <main className="nkrn-control flex min-h-screen items-center justify-center bg-zinc-950 text-white">
                <div className={`${glassCard} px-8 py-7 text-center`}>
                    <div className="mx-auto mb-4 h-3 w-3 animate-pulse rounded-full bg-[#e7b42b]" />
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#d7a31f]">
                        Logistics
                    </p>
                    <p className="mt-2 text-sm text-zinc-400">
                        Loading your Logistics portal…
                    </p>
                </div>
            </main>
        );
    }

    return (
        <main className="nkrn-control relative min-h-screen overflow-hidden bg-zinc-950 text-white">
            <div className="pointer-events-none fixed inset-0 overflow-hidden">
                <div className="absolute -left-40 -top-40 h-136 w-136 rounded-full bg-white/[0.035] blur-3xl" />
                <div className="absolute -right-40 top-1/4 h-152 w-152 rounded-full bg-[#d7a31f]/4.5 This process is not fast enough to explain their existence state. The universe is simply result to a supermassive holds that are formed by easing stars and merchant recharge. Something else I'm supposed to explain how we got the largest holes in the universe, we won't need the largest stars that existed greater stars to get a sense of stereostate. We didn't know if I start actually this is very court those that's a test started for a thousand times on starts into their holes while silent states in the process in cycle, field and eating material for into such agree that radiation pressure can start table, and so these grew grown and holds must need to consume spirit than any modern step hole. That holes several thousand times less than the sun and whether the new timer. These black holes are seats for so lesser than holes, so they're on the rightadjust to say introduced those tarry little far from the in my ears in sphere of darkness is so large that it comes out the entire source system and yet there is a sale even above these types of objects contract and a colds. I am the largest single bodies that will ever exist. These ma holes easily so much on the process, the engine for it to black hole in the central guarantee of J twenty seven is eighteen billion that is so making the head is holding three times large than secters ASR. This thing defines imagination and is really hard to compare to a thing it can never do fit free subsystems students. Let's end this in state conditions a geo, and then hold we dserved consuming gas is like a matter is shown by us of a hundred trillion stars visible from eighteen billionway. It has entra sixty six billion services in this process tons of stuff or customs ended negative to the finalfree trade of this. We've created a lot of bad core thoughts. This may be able to explore only from different animals and then gets continued funding their costs up to basically events. The sort of cause to set up much sort of go to the centre as a front standing level under the battery is traffic and removable object and an unstable false fortunately kind of material will be no useful mozle and then it's a productivity way to ensure the university where the similarvacuum absolute physical little shut to stop being such it was to stretch out and secure a situation that slow down to talk, but it's trapped insult and material. It's so cold, dark, complassive on the outside, style of the day in bak holes, but as a curve space rather a presold to fund effects made on black holes for tracking assessment where supremes all slowed down time to get clear not precious a draw time physicist for days. So they do work on people and fit or we see in the sun, so around actually considered them as a music practice should be set by the base drawn that he thought that stocks groups like should sell the music for the cosmos. Unfortunately, so this is my lifter perspective outwards and how the scatter looking for so it's assume that he is able to take horses all instead of the traffic smoke and no ice free I do it's answer what do you think decisions I'll return you let's listen to the secrets and we're covered as well as team drags you start very tight for riquez going ways to keep the system blur-3xl" />
            </div>

            <div className="relative z-10 mx-auto w-full max-w-7xl px-5 py-6 sm:px-8 lg:px-10 lg:py-8">
                <header className={`${glassCard} mb-7 overflow-hidden`}>
                    <div className="flex flex-col gap-5 border-b border-white/[0.07] px-5 py-5 sm:px-7 lg:flex-row lg:items-center lg:justify-between">
                        <div className="flex items-center gap-4">
                            <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-white/5">
                                <Image
                                    src="/wit-logo-tygies.png"
                                    alt="Laerskool Tygerpoort"
                                    width={130}
                                    height={52}
                                    className="h-auto w-24 object-contain"
                                    priority
                                />
                            </div>

                            <div>
                                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#d7a31f]">
                                    NKRN · Logistics
                                </p>
                                <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
                                    Staff Logistics Portal
                                </h1>
                                <p className="mt-1 text-sm text-zinc-500">
                                    Welcome, {user.firstName}. Request assistance,
                                    check venues and track progress.
                                </p>
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-3">
                            <button
                                type="button"
                                onClick={() => router.push("/")}
                                className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-zinc-300 transition hover:bg-white/10"
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

                    <nav className="flex gap-2 overflow-x-auto px-4 py-3 sm:px-6">
                        {[
                            ["home", "Overview"],
                            ["requests", "My Requests"],
                            ["venues", "Venue Bookings"],
                            ["map", "School Map"],
                        ].map(([key, label]) => (
                            <button
                                key={key}
                                type="button"
                                onClick={() => setView(key as PortalView)}
                                className={`shrink-0 rounded-xl border px-4 py-2 text-xs font-semibold uppercase tracking-[0.13em] transition ${
                                    view === key
                                        ? "border-[#d7a31f]/30 bg-[#d7a31f]/10 text-[#e7b42b]"
                                        : "border-white/10 bg-white/4 text-zinc-400 hover:bg-white/8"
                                }`}
                            >
                                {label}
                            </button>
                        ))}
                    </nav>
                </header>

                {error && (
                    <div className="mb-5 rounded-2xl border border-red-400/15 bg-red-500/8 px-5 py-4 text-sm text-red-200">
                        {error}
                    </div>
                )}

                {success && (
                    <div className="mb-5 rounded-2xl border border-green-400/15 bg-green-500/8 px-5 py-4 text-sm text-green-200">
                        {success}
                    </div>
                )}

                {view === "home" && (
                    <>
                        <section className={`${glassCard} mb-6 overflow-hidden p-6 sm:p-8`}>
                            <div className="grid gap-8 lg:grid-cols-[1.25fr_0.75fr] lg:items-end">
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#d7a31f]">
                                        Logistics Service Desk
                                    </p>
                                    <h2 className="mt-2 max-w-3xl text-3xl font-bold tracking-tight sm:text-4xl">
                                        What can the Logistics team help you with?
                                    </h2>
                                    <p className="mt-4 max-w-2xl text-sm leading-6 text-zinc-400">
                                        Submit one short request and NKRN will keep
                                        the request, venue information and progress
                                        together.
                                    </p>
                                </div>

                                <button
                                    type="button"
                                    onClick={() => openRequestForm()}
                                    className="rounded-2xl border border-[#d7a31f]/30 bg-[#d7a31f]/12 px-6 py-4 text-left transition hover:border-[#e7b42b]/55 hover:bg-[#d7a31f]/18"
                                >
                                    <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[#e7b42b]">
                                        New Request
                                    </span>
                                    <span className="mt-1 block text-xl font-semibold text-white">
                                        + Request Logistics Assistance
                                    </span>
                                </button>
                            </div>
                        </section>

                        <section className="mb-6 grid gap-4 md:grid-cols-3">
                            <button
                                type="button"
                                onClick={() => openRequestForm("Event")}
                                className={`${glassCard} p-5 text-left transition hover:-translate-y-0.5 hover:border-[#d7a31f]/30`}
                            >
                                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#d7a31f]">
                                    Event & Venue
                                </p>
                                <h3 className="mt-2 text-lg font-semibold">
                                    Event support
                                </h3>
                                <p className="mt-2 text-sm leading-6 text-zinc-500">
                                    Venue, tables, chairs, gazebos and other setup.
                                </p>
                            </button>

                            <button
                                type="button"
                                onClick={() => openRequestForm("Maintenance")}
                                className={`${glassCard} p-5 text-left transition hover:-translate-y-0.5 hover:border-[#d7a31f]/30`}
                            >
                                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#d7a31f]">
                                    Maintenance
                                </p>
                                <h3 className="mt-2 text-lg font-semibold">
                                    Report a problem
                                </h3>
                                <p className="mt-2 text-sm leading-6 text-zinc-500">
                                    Repair, replacement, furniture or facility issues.
                                </p>
                            </button>

                            <button
                                type="button"
                                onClick={() => openRequestForm("General")}
                                className={`${glassCard} p-5 text-left transition hover:-translate-y-0.5 hover:border-[#d7a31f]/30`}
                            >
                                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#d7a31f]">
                                    General
                                </p>
                                <h3 className="mt-2 text-lg font-semibold">
                                    Other assistance
                                </h3>
                                <p className="mt-2 text-sm leading-6 text-zinc-500">
                                    Anything that does not fit the other categories.
                                </p>
                            </button>
                        </section>

                        <section className="grid gap-6 lg:grid-cols-2">
                            <div className={`${glassCard} overflow-hidden`}>
                                <div className="flex items-center justify-between border-b border-white/8 p-5">
                                    <div>
                                        <p className="text-xs uppercase tracking-[0.2em] text-zinc-600">
                                            My Requests
                                        </p>
                                        <h2 className="mt-1 text-xl font-semibold">
                                            Active requests
                                        </h2>
                                    </div>
                                    <span className="text-3xl font-bold text-[#e7b42b]">
                                        {activeRequests.length}
                                    </span>
                                </div>

                                <div className="divide-y divide-white/7">
                                    {activeRequests.slice(0, 5).map((request) => (
                                        <button
                                            type="button"
                                            key={request.requestID}
                                            onClick={() => setView("requests")}
                                            className="block w-full p-5 text-left transition hover:bg-white/3"
                                        >
                                            <div className="flex items-start justify-between gap-4">
                                                <div>
                                                    <p className="font-medium">
                                                        {request.title}
                                                    </p>
                                                    <p className="mt-1 text-xs text-zinc-500">
                                                        #{request.requestID} ·{" "}
                                                        {requestLocation(request)}
                                                    </p>
                                                </div>
                                                <span
                                                    className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${statusStyle(
                                                        request.status
                                                    )}`}
                                                >
                                                    {request.status}
                                                </span>
                                            </div>
                                        </button>
                                    ))}

                                    {activeRequests.length === 0 && (
                                        <p className="p-5 text-sm text-zinc-500">
                                            You have no active Logistics requests.
                                        </p>
                                    )}
                                </div>
                            </div>

                            <div className={`${glassCard} overflow-hidden`}>
                                <div className="flex items-center justify-between border-b border-white/8 p-5">
                                    <div>
                                        <p className="text-xs uppercase tracking-[0.2em] text-zinc-600">
                                            Facilities
                                        </p>
                                        <h2 className="mt-1 text-xl font-semibold">
                                            Upcoming venue bookings
                                        </h2>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setView("venues")}
                                        className="text-xs font-semibold uppercase tracking-[0.14em] text-[#e7b42b]"
                                    >
                                        View all
                                    </button>
                                </div>

                                <div className="divide-y divide-white/7">
                                    {bookings.slice(0, 5).map((booking) => (
                                        <div key={booking.bookingID} className="p-5">
                                            <p className="font-medium">{booking.title}</p>
                                            <p className="mt-1 text-xs text-zinc-500">
                                                {booking.locationName} ·{" "}
                                                {displayDate(booking.bookingDate)} ·{" "}
                                                {shortTime(booking.startTime)}–
                                                {shortTime(booking.endTime)}
                                            </p>
                                        </div>
                                    ))}

                                    {bookings.length === 0 && (
                                        <p className="p-5 text-sm text-zinc-500">
                                            No upcoming venue bookings are recorded.
                                        </p>
                                    )}
                                </div>
                            </div>
                        </section>
                    </>
                )}

                {view === "requests" && (
                    <section className={`${glassCard} overflow-hidden`}>
                        <div className="flex flex-col gap-4 border-b border-white/8 p-5 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#d7a31f]">
                                    My Logistics Requests
                                </p>
                                <h2 className="mt-1 text-2xl font-semibold">
                                    Request history
                                </h2>
                            </div>

                            <button
                                type="button"
                                onClick={() => openRequestForm()}
                                className="rounded-xl border border-[#d7a31f]/30 bg-[#d7a31f]/10 px-4 py-2.5 text-sm font-medium text-[#e7b42b]"
                            >
                                + New Request
                            </button>
                        </div>

                        <div className="divide-y divide-white/7">
                            {requests.map((request) => (
                                <article key={request.requestID} className="p-5 sm:p-6">
                                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                                        <div>
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className="font-mono text-xs text-zinc-600">
                                                    #{request.requestID}
                                                </span>
                                                <span className="text-xs text-zinc-600">
                                                    {request.requestType}
                                                    {request.activityCategory
                                                        ? ` · ${request.activityCategory}`
                                                        : ""}
                                                </span>
                                            </div>

                                            <h3 className="mt-2 text-lg font-semibold">
                                                {request.title}
                                            </h3>

                                            <p className="mt-1 text-sm text-zinc-500">
                                                {requestLocation(request)}
                                                {request.activityDate
                                                    ? ` · ${displayDate(
                                                          request.activityDate
                                                      )}`
                                                    : ""}
                                            </p>

                                            {request.description && (
                                                <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-400">
                                                    {request.description}
                                                </p>
                                            )}

                                            {request.managerNotes && (
                                                <div className="mt-4 rounded-xl border border-[#d7a31f]/15 bg-[#d7a31f]/6 px-4 py-3">
                                                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#d7a31f]">
                                                        Logistics Team
                                                    </p>
                                                    <p className="mt-1 text-sm text-zinc-300">
                                                        {request.managerNotes}
                                                    </p>
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex shrink-0 flex-col items-start gap-3 sm:items-end">
                                            <span
                                                className={`rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${statusStyle(
                                                    request.status
                                                )}`}
                                            >
                                                {request.status}
                                            </span>

                                            {![
                                                "Converted",
                                                "Completed",
                                                "Cancelled",
                                            ].includes(request.status) && (
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        void cancelRequest(request)
                                                    }
                                                    className="text-xs text-zinc-600 transition hover:text-red-300"
                                                >
                                                    Cancel request
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </article>
                            ))}

                            {requests.length === 0 && (
                                <p className="p-6 text-sm text-zinc-500">
                                    No Logistics requests submitted yet.
                                </p>
                            )}
                        </div>
                    </section>
                )}

                {view === "venues" && (
                    <section className={`${glassCard} overflow-hidden`}>
                        <div className="border-b border-white/8 p-5 sm:p-6">
                            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#d7a31f]">
                                Venue Availability
                            </p>
                            <h2 className="mt-1 text-2xl font-semibold">
                                Upcoming bookings
                            </h2>
                            <p className="mt-2 text-sm text-zinc-500">
                                Teachers can see confirmed and pending venue use before
                                submitting an event request.
                            </p>
                        </div>

                        <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-3">
                            {bookings.map((booking) => (
                                <div
                                    key={booking.bookingID}
                                    className="rounded-2xl border border-white/8 bg-black/15 p-5"
                                >
                                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#d7a31f]">
                                        {booking.locationName}
                                    </p>
                                    <h3 className="mt-2 font-semibold">
                                        {booking.title}
                                    </h3>
                                    <p className="mt-2 text-sm text-zinc-500">
                                        {displayDate(booking.bookingDate)}
                                    </p>
                                    <p className="mt-1 text-sm text-zinc-400">
                                        {shortTime(booking.startTime)}–
                                        {shortTime(booking.endTime)}
                                    </p>
                                </div>
                            ))}

                            {bookings.length === 0 && (
                                <p className="text-sm text-zinc-500">
                                    No venue bookings are currently recorded.
                                </p>
                            )}
                        </div>
                    </section>
                )}

                {view === "map" && (
                    <section className="grid gap-6 lg:grid-cols-[1.35fr_0.65fr]">
                        <div className={`${glassCard} overflow-hidden`}>
                            <div className="border-b border-white/8 p-5 sm:p-6">
                                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#d7a31f]">
                                    School Map
                                </p>
                                <h2 className="mt-1 text-2xl font-semibold">
                                    Locations & venues
                                </h2>
                                <p className="mt-2 text-sm text-zinc-500">
                                    Select a confirmed NKRN location to see its
                                    bookings. The detailed campus SVG can later plug
                                    into these same Location IDs.
                                </p>
                            </div>

                            <div className="grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-3">
                                {referenceData.locations.map((location) => (
                                    <button
                                        key={location.locationID}
                                        type="button"
                                        onClick={() =>
                                            setSelectedMapLocationID(
                                                location.locationID
                                            )
                                        }
                                        className={`min-h-28 rounded-2xl border p-4 text-left transition ${
                                            selectedMapLocationID ===
                                            location.locationID
                                                ? "border-[#d7a31f]/45 bg-[#d7a31f]/10"
                                                : "border-white/8 bg-black/15 hover:border-[#d7a31f]/25 hover:bg-white/4"
                                        }`}
                                    >
                                        <p className="text-xs uppercase tracking-[0.15em] text-zinc-600">
                                            {location.locationType}
                                        </p>
                                        <p className="mt-2 font-semibold text-white">
                                            {location.locationName}
                                        </p>
                                        <p className="mt-2 text-xs text-zinc-500">
                                            {location.canBeBooked
                                                ? "Bookable venue"
                                                : "School location"}
                                        </p>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <aside className={`${glassCard} h-fit p-5 sm:p-6`}>
                            {selectedMapLocation ? (
                                <>
                                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#d7a31f]">
                                        Selected Location
                                    </p>
                                    <h3 className="mt-2 text-2xl font-semibold">
                                        {selectedMapLocation.locationName}
                                    </h3>
                                    <p className="mt-1 text-sm text-zinc-500">
                                        {selectedMapLocation.locationType}
                                    </p>

                                    <div className="my-5 h-px bg-white/8" />

                                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-600">
                                        Upcoming bookings
                                    </p>

                                    <div className="mt-3 space-y-3">
                                        {selectedLocationBookings.map((booking) => (
                                            <div
                                                key={booking.bookingID}
                                                className="rounded-xl border border-white/8 bg-black/15 p-3"
                                            >
                                                <p className="text-sm font-medium">
                                                    {booking.title}
                                                </p>
                                                <p className="mt-1 text-xs text-zinc-500">
                                                    {displayDate(
                                                        booking.bookingDate
                                                    )}{" "}
                                                    ·{" "}
                                                    {shortTime(
                                                        booking.startTime
                                                    )}
                                                    –
                                                    {shortTime(booking.endTime)}
                                                </p>
                                            </div>
                                        ))}

                                        {selectedLocationBookings.length === 0 && (
                                            <p className="text-sm text-zinc-500">
                                                No upcoming bookings.
                                            </p>
                                        )}
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() => {
                                            openRequestForm(
                                                selectedMapLocation.canBeBooked
                                                    ? "Event"
                                                    : "Maintenance"
                                            );
                                            setLocationID(
                                                String(
                                                    selectedMapLocation.locationID
                                                )
                                            );
                                        }}
                                        className="mt-5 w-full rounded-xl border border-[#d7a31f]/30 bg-[#d7a31f]/10 px-4 py-3 text-sm font-medium text-[#e7b42b]"
                                    >
                                        {selectedMapLocation.canBeBooked
                                            ? "Request this venue"
                                            : "Report an issue here"}
                                    </button>
                                </>
                            ) : (
                                <p className="text-sm leading-6 text-zinc-500">
                                    Select a location on the left to view its details.
                                </p>
                            )}
                        </aside>
                    </section>
                )}

                <footer className="mt-10 flex items-center justify-between border-t border-white/7 py-6 text-xs text-zinc-600">
                    <span>Laerskool Tygerpoort · Logistics</span>
                    <span className="font-semibold tracking-wide text-zinc-500">
                        NKRN™ ©
                    </span>
                </footer>
            </div>

            {requestOpen && (
                <div
                    className="fixed inset-0 z-50 overflow-y-auto bg-black/75 px-4 py-6 backdrop-blur-sm sm:py-10"
                    onMouseDown={(event) => {
                        if (
                            event.target === event.currentTarget &&
                            !submitting
                        ) {
                            setRequestOpen(false);
                        }
                    }}
                >
                    <div className="mx-auto my-auto w-full max-w-3xl rounded-[30px] border border-white/10 bg-zinc-950/95 shadow-2xl shadow-black/50">
                        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 rounded-t-[30px] border-b border-white/8 bg-zinc-950/95 p-5 backdrop-blur-xl sm:p-6">
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#d7a31f]">
                                    New Logistics Request
                                </p>
                                <h2 className="mt-1 text-2xl font-semibold">
                                    How can we help?
                                </h2>
                            </div>

                            <button
                                type="button"
                                disabled={submitting}
                                onClick={() => setRequestOpen(false)}
                                className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-400"
                            >
                                Close
                            </button>
                        </div>

                        <div className="space-y-6 p-5 sm:p-6">
                            <div>
                                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.15em] text-zinc-500">
                                    Request Type
                                </label>
                                <div className="grid gap-3 sm:grid-cols-3">
                                    {[
                                        ["Event", "Event / Venue"],
                                        ["Maintenance", "Repair / Maintenance"],
                                        ["General", "General Logistics"],
                                    ].map(([value, label]) => (
                                        <button
                                            key={value}
                                            type="button"
                                            onClick={() =>
                                                setRequestType(
                                                    value as
                                                        | "Event"
                                                        | "Maintenance"
                                                        | "General"
                                                )
                                            }
                                            className={`rounded-xl border px-4 py-3 text-sm font-medium transition ${
                                                requestType === value
                                                    ? "border-[#d7a31f]/40 bg-[#d7a31f]/10 text-[#e7b42b]"
                                                    : "border-white/10 bg-white/4 text-zinc-400"
                                            }`}
                                        >
                                            {label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {requestType === "Event" && (
                                <div>
                                    <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.15em] text-zinc-500">
                                        Activity Category
                                    </label>
                                    <select
                                        value={activityCategory}
                                        onChange={(event) =>
                                            setActivityCategory(
                                                event.target.value
                                            )
                                        }
                                        className={selectClass}
                                    >
                                        {referenceData.activityCategories.map(
                                            (category) => (
                                                <option
                                                    key={category}
                                                    value={category}
                                                >
                                                    {category}
                                                </option>
                                            )
                                        )}
                                    </select>
                                </div>
                            )}

                            <div>
                                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.15em] text-zinc-500">
                                    Short Title
                                </label>
                                <input
                                    value={title}
                                    onChange={(event) =>
                                        setTitle(event.target.value)
                                    }
                                    placeholder={
                                        requestType === "Event"
                                            ? "e.g. Grade 5 Parent Evening"
                                            : requestType === "Maintenance"
                                            ? "e.g. Broken classroom window"
                                            : "What assistance do you need?"
                                    }
                                    className={inputClass}
                                />
                            </div>

                            <div>
                                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.15em] text-zinc-500">
                                    Location
                                </label>
                                <select
                                    value={locationID}
                                    onChange={(event) => {
                                        setLocationID(event.target.value);
                                        setAvailabilityMessage("");
                                        setAvailabilityOkay(null);
                                    }}
                                    className={selectClass}
                                >
                                    <option value="">Select a location…</option>
                                    {referenceData.locations.map((location) => (
                                        <option
                                            key={location.locationID}
                                            value={String(location.locationID)}
                                        >
                                            {location.locationName}
                                        </option>
                                    ))}
                                </select>

                                <input
                                    value={customLocation}
                                    onChange={(event) =>
                                        setCustomLocation(event.target.value)
                                    }
                                    placeholder="Or type a classroom / area not listed above"
                                    className={`${inputClass} mt-3`}
                                />
                            </div>

                            {requestType === "Event" && (
                                <>
                                    <div className="grid gap-4 sm:grid-cols-3">
                                        <div>
                                            <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.15em] text-zinc-500">
                                                Date
                                            </label>
                                            <input
                                                type="date"
                                                min={todayISO()}
                                                value={activityDate}
                                                onChange={(event) => {
                                                    setActivityDate(
                                                        event.target.value
                                                    );
                                                    setAvailabilityMessage("");
                                                    setAvailabilityOkay(null);
                                                }}
                                                className={inputClass}
                                            />
                                        </div>
                                        <div>
                                            <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.15em] text-zinc-500">
                                                Start
                                            </label>
                                            <input
                                                type="time"
                                                value={startTime}
                                                onChange={(event) => {
                                                    setStartTime(
                                                        event.target.value
                                                    );
                                                    setAvailabilityMessage("");
                                                    setAvailabilityOkay(null);
                                                }}
                                                className={inputClass}
                                            />
                                        </div>
                                        <div>
                                            <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.15em] text-zinc-500">
                                                Finish
                                            </label>
                                            <input
                                                type="time"
                                                value={endTime}
                                                onChange={(event) => {
                                                    setEndTime(
                                                        event.target.value
                                                    );
                                                    setAvailabilityMessage("");
                                                    setAvailabilityOkay(null);
                                                }}
                                                className={inputClass}
                                            />
                                        </div>
                                    </div>

                                    <div className="rounded-2xl border border-white/8 bg-white/3 p-4">
                                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                            <div>
                                                <p className="text-sm font-medium">
                                                    Venue availability
                                                </p>
                                                <p
                                                    className={`mt-1 text-xs ${
                                                        availabilityOkay === true
                                                            ? "text-green-300"
                                                            : availabilityOkay ===
                                                              false
                                                            ? "text-red-300"
                                                            : "text-zinc-500"
                                                    }`}
                                                >
                                                    {availabilityMessage ||
                                                        "Check the selected venue before submitting."}
                                                </p>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    void checkAvailability()
                                                }
                                                disabled={
                                                    checkingAvailability ||
                                                    !locationID
                                                }
                                                className="rounded-xl border border-white/10 bg-white/6 px-4 py-2.5 text-sm text-zinc-300 disabled:opacity-40"
                                            >
                                                {checkingAvailability
                                                    ? "Checking…"
                                                    : "Check availability"}
                                            </button>
                                        </div>
                                    </div>

                                    <label className="flex items-center gap-3 rounded-xl border border-white/8 bg-white/3 p-4">
                                        <input
                                            type="checkbox"
                                            checked={cleanupNextDay}
                                            onChange={(event) =>
                                                setCleanupNextDay(
                                                    event.target.checked
                                                )
                                            }
                                            className="h-4 w-4 accent-[#d7a31f]"
                                        />
                                        <span className="text-sm text-zinc-300">
                                            Cleanup is required the following morning
                                        </span>
                                    </label>

                                    <div>
                                        <label className="mb-3 block text-xs font-semibold uppercase tracking-[0.15em] text-zinc-500">
                                            Equipment Required
                                        </label>
                                        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                                            {referenceData.equipment.map((item) => {
                                                const selected =
                                                    selectedEquipment.includes(
                                                        item.equipmentTypeID
                                                    );

                                                return (
                                                    <label
                                                        key={item.equipmentTypeID}
                                                        className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 text-sm ${
                                                            selected
                                                                ? "border-[#d7a31f]/30 bg-[#d7a31f]/8 text-zinc-200"
                                                                : "border-white/8 bg-white/3 text-zinc-400"
                                                        }`}
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            checked={selected}
                                                            onChange={() =>
                                                                setSelectedEquipment(
                                                                    (current) =>
                                                                        selected
                                                                            ? current.filter(
                                                                                  (
                                                                                      id
                                                                                  ) =>
                                                                                      id !==
                                                                                      item.equipmentTypeID
                                                                              )
                                                                            : [
                                                                                  ...current,
                                                                                  item.equipmentTypeID,
                                                                              ]
                                                                )
                                                            }
                                                            className="accent-[#d7a31f]"
                                                        />
                                                        {item.equipmentName}
                                                    </label>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </>
                            )}

                            {requestType === "Maintenance" && (
                                <>
                                    <div>
                                        <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.15em] text-zinc-500">
                                            What needs attention?
                                        </label>
                                        <select
                                            value={maintenanceTypeID}
                                            onChange={(event) =>
                                                setMaintenanceTypeID(
                                                    event.target.value
                                                )
                                            }
                                            className={selectClass}
                                        >
                                            <option value="">
                                                Select an item…
                                            </option>
                                            {referenceData.maintenance.map(
                                                (item) => (
                                                    <option
                                                        key={
                                                            item.maintenanceTypeID
                                                        }
                                                        value={String(
                                                            item.maintenanceTypeID
                                                        )}
                                                    >
                                                        {item.maintenanceName}
                                                    </option>
                                                )
                                            )}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.15em] text-zinc-500">
                                            What is required?
                                        </label>
                                        <div className="grid gap-3 sm:grid-cols-3">
                                            {[
                                                ["Repair", "Repair"],
                                                ["Replace", "Replace"],
                                                ["Unsure", "Not sure"],
                                            ].map(([value, label]) => (
                                                <button
                                                    type="button"
                                                    key={value}
                                                    onClick={() =>
                                                        setMaintenanceAction(
                                                            value as
                                                                | "Repair"
                                                                | "Replace"
                                                                | "Unsure"
                                                        )
                                                    }
                                                    className={`rounded-xl border px-4 py-3 text-sm ${
                                                        maintenanceAction ===
                                                        value
                                                            ? "border-[#d7a31f]/35 bg-[#d7a31f]/10 text-[#e7b42b]"
                                                            : "border-white/8 bg-white/3 text-zinc-400"
                                                    }`}
                                                >
                                                    {label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </>
                            )}

                            <div>
                                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.15em] text-zinc-500">
                                    Description
                                </label>
                                <textarea
                                    value={description}
                                    onChange={(event) =>
                                        setDescription(event.target.value)
                                    }
                                    rows={5}
                                    placeholder="Add the important details. Keep it short and clear."
                                    className={inputClass}
                                />
                            </div>

                            <div className="rounded-2xl border border-white/8 bg-white/3 p-4">
                                <p className="text-xs text-zinc-500">
                                    Submitted as
                                </p>
                                <p className="mt-1 text-sm font-medium text-zinc-200">
                                    {user.firstName} {user.lastName}
                                </p>
                                <p className="text-xs text-zinc-600">
                                    {user.email}
                                </p>
                            </div>

                            <div className="flex flex-col-reverse gap-3 border-t border-white/8 pt-5 sm:flex-row sm:justify-end">
                                <button
                                    type="button"
                                    disabled={submitting}
                                    onClick={() => setRequestOpen(false)}
                                    className="rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm text-zinc-300"
                                >
                                    Cancel
                                </button>

                                <button
                                    type="button"
                                    disabled={submitting}
                                    onClick={() => void submitRequest()}
                                    className="rounded-xl border border-[#d7a31f]/35 bg-[#d7a31f]/12 px-5 py-3 text-sm font-semibold text-[#e7b42b] transition hover:bg-[#d7a31f]/18 disabled:opacity-50"
                                >
                                    {submitting
                                        ? "Submitting…"
                                        : "Submit Logistics Request"}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </main>
    );
}
