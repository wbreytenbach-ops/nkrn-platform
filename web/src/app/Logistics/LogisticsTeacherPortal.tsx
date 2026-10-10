"use client";
import LogisticsRequestDiscussion from "./LogisticsRequestDiscussion";
import ItAiAssistant from "../components/ItAiAssistant";

import { displayLabel, requestStage } from "./labels";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useLanguage } from "../language";
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

    return date.toLocaleDateString((typeof document !== "undefined" && document.documentElement.lang === "en" ? "en-ZA" : "af-ZA"), {
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
    const value = requestStage(status).toLowerCase();

    if (value === "done") {
        return "border-green-400/15 bg-green-500/10 text-green-300";
    }

    if (value === "busy") {
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
    const { language } = useLanguage();

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

    const [step, setStep] = useState(0);
    const [requestOpen, setRequestOpen] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    const [requestType, setRequestType] = useState<"Event" | "Maintenance" | "General" | "Security">("Event");
    const [activityCategory, setActivityCategory] = useState("Other");
    const [description, setDescription] = useState("");
    const [aiSessionID, setAiSessionID] = useState<string | null>(null);
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
                    : "Logistiek kon nie gelaai word nie."
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
            requests.filter((request) => {
                const stage = requestStage(request.status);
                return !["Done", "Declined", "Cancelled"].includes(stage);
            }),
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
        setActivityCategory("Other");
        setDescription("");
        setAiSessionID(null);
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

    function openRequestForm(type?: "Event" | "Maintenance" | "General" | "Security") {
        resetRequestForm();
        if (type) {
            setRequestType(type);
        }
        setError("");
        setSuccess("");
        setStep(type ? 1 : 0);
        setRequestOpen(true);
    }

    async function checkAvailability() {
        if (!locationID || !activityDate || !startTime || !endTime) {
            setAvailabilityOkay(null);
            setAvailabilityMessage(
                "Kies eers ’n lokaal, datum, begintyd en eindtyd."
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
                throw new Error(body || (language === "af" ? "Lokaalbeskikbaarheid kon nie nagegaan word nie." : "Venue availability could not be checked."));
            }

            const result = (await response.json()) as {
                available: boolean;
                conflicts: VenueBooking[];
            };

            setAvailabilityOkay(result.available);

            if (result.available) {
                setAvailabilityMessage(language === "af" ? "Die lokaal is beskikbaar vir hierdie tyd." : "The venue is available for this time.");
            } else {
                const conflict = result.conflicts[0];

                setAvailabilityMessage(
                    conflict
                        ? `Reeds bespreek: ${conflict.title} (${shortTime(
                              conflict.startTime
                          )}–${shortTime(conflict.endTime)}).`
                        : "Die lokaal is reeds vir hierdie tyd bespreek."
                );
            }
        } catch (availabilityError) {
            setAvailabilityOkay(null);
            setAvailabilityMessage(
                availabilityError instanceof Error
                    ? availabilityError.message
                    : "Lokaalbeskikbaarheid kon nie nagegaan word nie."
            );
        } finally {
            setCheckingAvailability(false);
        }
    }

    function continueToReview() {
        if (!description.trim()) {
            setError(
                requestType === "Maintenance"
                    ? "Beskryf kortliks wat fout is of wat aandag benodig."
                    : requestType === "Event"
                    ? "Beskryf kortliks die funksie of aktiwiteit en wat benodig word."
                    : "Beskryf kortliks waarmee Logistics kan help."
            );
            return;
        }

        if (requestType === "Event") {
            if (!activityDate || !startTime || !endTime) {
                setError(
                    "Vul die aktiwiteitsdatum, begin- en eindtyd in."
                );
                return;
            }

            if (endTime <= startTime) {
                setError("Die eindtyd moet ná die begintyd wees.");
                return;
            }
        }

        if (
            requestType === "Maintenance" &&
            !maintenanceTypeID
        ) {
            setError("Kies wat aandag benodig.");
            return;
        }

        setError("");

        if (
            requestType === "Event" &&
            locationID &&
            activityDate &&
            startTime &&
            endTime
        ) {
            void checkAvailability();
        }

        setStep(2);
    }

    async function submitRequest() {
        if (!description.trim()) {
            setError(
                requestType === "Maintenance"
                    ? "Beskryf kortliks wat fout is of wat aandag benodig."
                    : requestType === "Event"
                    ? "Beskryf kortliks die funksie of aktiwiteit en wat benodig word."
                    : "Beskryf kortliks waarmee Logistics kan help."
            );
            return;
        }

        if (requestType === "Event") {
            if (!activityDate || !startTime || !endTime) {
                setError("Vul die aktiwiteitsdatum, begin- en eindtyd in.");
                return;
            }

            if (endTime <= startTime) {
                setError("Die eindtyd moet ná die begintyd wees.");
                return;
            }
        }

        if (
            requestType === "Maintenance" &&
            !maintenanceTypeID
        ) {
            setError("Kies wat aandag benodig.");
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

            const equipment = (requestType === "Event" ? selectedEquipment : []).map((equipmentTypeID) => ({
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
                    title: "Logistics-versoek",
                    description: description.trim() || null,
                    activityDate:
                        requestType === "Event" ? activityDate : null,
                    startTime:
                        requestType === "Event" ? `${startTime}:00` : null,
                    endTime:
                        requestType === "Event" ? `${endTime}:00` : null,
                    cleanupNextDay:
                        requestType === "Event" ? cleanupNextDay : null,                    aiSessionID,

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
                let message = "Die Logistics-versoek kon nie ingedien word nie.";

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
                language === "af"
                    ? `Versoek #${created.requestID} is aan die Logistics-span gestuur.`
                    : `Request #${created.requestID} was sent to the Logistics team.`
            );

            await loadPortal();
            setView("requests");
        } catch (submitError) {
            console.error("Unable to submit Logistics request:", submitError);
            setError(
                submitError instanceof Error
                    ? submitError.message
                    : "Die Logistics-versoek kon nie ingedien word nie."
            );
        } finally {
            setSubmitting(false);
        }
    }

    async function cancelRequest(request: LogisticsRequest) {
        if (
            !window.confirm(
                `Kanselleer Logistieke versoek #${request.requestID}?`
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
                let message = "Die versoek kon nie gekanselleer word nie.";

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

            setSuccess(`Versoek #${request.requestID} is gekanselleer.`);
            await loadPortal();
        } catch (cancelError) {
            setError(
                cancelError instanceof Error
                    ? cancelError.message
                    : "Die versoek kon nie gekanselleer word nie."
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
                        Jou Logistics-portaal laai…
                    </p>
                </div>
            </main>
        );
    }

    return (
        <main className="nkrn-control nkrn-logistics-simplified q4-logistics relative min-h-screen overflow-hidden bg-zinc-950 text-white">
            <div className="pointer-events-none fixed inset-0 overflow-hidden">
                <div className="absolute -left-40 -top-40 h-136 w-136 rounded-full bg-white/[0.035] blur-3xl" />
                <div className="absolute -right-40 top-1/4 h-152 w-152 rounded-full bg-[#d7a31f]/4.5 blur-3xl" />
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
                                    Personeelportaal
                                </h1>
                                <p className="mt-1 text-sm text-zinc-500">
                                    Welkom, {user.firstName}. Dien versoeke in,
                                    kyk na lokale en volg vordering op.
                                </p>
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-3">
                            <button
                                type="button"
                                onClick={() => router.push("/")}
                                className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-zinc-300 transition hover:bg-white/10"
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

                    <nav className="flex gap-2 overflow-x-auto px-4 py-3 sm:px-6">
                        {[
                            ["home", "Oorsig"],
                            ["requests", "My versoeke"],
                            ["venues", "Lokaalbesprekings"],
                            ["map", "Skoolkaart"],
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
                                        Logistiek: Versoeke en terugvoer
                                    </p>
                                    <h2 className="mt-2 max-w-3xl text-3xl font-bold tracking-tight sm:text-4xl">
                                        Waarmee kan die Logistics-span jou help?
                                    </h2>
                                    <p className="mt-4 max-w-2xl text-sm leading-6 text-zinc-400">
                                        Dien een kort versoek in. NKRN hou die besonderhede,
                                        lokaal-inligting en vordering
                                        op een plek.
                                    </p>
                                </div>

                                <button
                                    type="button"
                                    onClick={() => openRequestForm()}
                                    className="rounded-2xl border border-[#d7a31f]/30 bg-[#d7a31f]/12 px-6 py-4 text-left transition hover:border-[#e7b42b]/55 hover:bg-[#d7a31f]/18"
                                >
                                    <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[#e7b42b]">
                                        Nuwe versoek
                                    </span>
                                    <span className="mt-1 block text-xl font-semibold text-white">
                                        + Versoek ondersteuning
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
                                    Funksie / Aktiwiteit
                                </p>
                                <h3 className="mt-2 text-lg font-semibold">
                                    Funksieondersteuning
                                </h3>
                                <p className="mt-2 text-sm leading-6 text-zinc-500">
                                    Lokale, tafels, stoele, gazebo’s en ander opstelling.
                                </p>
                            </button>

                            <button
                                type="button"
                                onClick={() => openRequestForm("Maintenance")}
                                className={`${glassCard} p-5 text-left transition hover:-translate-y-0.5 hover:border-[#d7a31f]/30`}
                            >
                                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#d7a31f]">
                                    Instandhouding
                                </p>
                                <h3 className="mt-2 text-lg font-semibold">
                                    Meld ’n probleem aan
                                </h3>
                                <p className="mt-2 text-sm leading-6 text-zinc-500">
                                    Herstel, vervanging, meubels of fasiliteitsprobleme.
                                </p>
                            </button>

                            <button
                                type="button"
                                onClick={() => openRequestForm("General")}
                                className={`${glassCard} p-5 text-left transition hover:-translate-y-0.5 hover:border-[#d7a31f]/30`}
                            >
                                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#d7a31f]">
                                    Algemeen
                                </p>
                                <h3 className="mt-2 text-lg font-semibold">
                                    Ander ondersteuning
                                </h3>
                                <p className="mt-2 text-sm leading-6 text-zinc-500">
                                    Enige ander bedryfsondersteuning.
                                </p>
                            </button>
                        </section>

                        <section className="grid gap-6 lg:grid-cols-2">
                            <div className={`${glassCard} overflow-hidden`}>
                                <div className="flex items-center justify-between border-b border-white/8 p-5">
                                    <div>
                                        <p className="text-xs uppercase tracking-[0.2em] text-zinc-600">
                                            My versoeke
                                        </p>
                                        <h2 className="mt-1 text-xl font-semibold">
                                            Aktiewe versoeke
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
                                                    {displayLabel(request.status)}
                                                </span>
                                            </div>
                                        </button>
                                    ))}

                                    {activeRequests.length === 0 && (
                                        <p className="p-5 text-sm text-zinc-500">
                                            Jy het geen aktiewe Logistics-versoeke nie.
                                        </p>
                                    )}
                                </div>
                            </div>

                            <div className={`${glassCard} overflow-hidden`}>
                                <div className="flex items-center justify-between border-b border-white/8 p-5">
                                    <div>
                                        <p className="text-xs uppercase tracking-[0.2em] text-zinc-600">
                                            Fasiliteite
                                        </p>
                                        <h2 className="mt-1 text-xl font-semibold">
                                            Komende lokaalbesprekings
                                        </h2>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setView("venues")}
                                        className="text-xs font-semibold uppercase tracking-[0.14em] text-[#e7b42b]"
                                    >
                                        Sien alles
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
                                            Geen komende lokaalbesprekings nie.
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
                                    My Logistics-versoeke
                                </p>
                                <h2 className="mt-1 text-2xl font-semibold">
                                    Versoekgeskiedenis
                                </h2>
                            </div>

                            <button
                                type="button"
                                onClick={() => openRequestForm()}
                                className="rounded-xl border border-[#d7a31f]/30 bg-[#d7a31f]/10 px-4 py-2.5 text-sm font-medium text-[#e7b42b]"
                            >
                                + Nuwe versoek
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
                                                    {displayLabel(request.requestType)}
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
                                                        Logistics-span
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
                                                {displayLabel(request.status)}
                                            </span>

                                            {!request.convertedTaskID && ![
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
                                                    Kanselleer versoek
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                    <LogisticsRequestDiscussion requestID={request.requestID} />
                                </article>
                            ))}

                            {requests.length === 0 && (
                                <p className="p-6 text-sm text-zinc-500">
                                    Nog geen Logistics-versoeke ingedien nie.
                                </p>
                            )}
                        </div>
                    </section>
                )}

                {view === "venues" && (
                    <section className={`${glassCard} overflow-hidden`}>
                        <div className="border-b border-white/8 p-5 sm:p-6">
                            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#d7a31f]">
                                Lokaalbeskikbaarheid
                            </p>
                            <h2 className="mt-1 text-2xl font-semibold">
                                Komende besprekings
                            </h2>
                            <p className="mt-2 text-sm text-zinc-500">
                                Sien bestaande en hangende lokaalbesprekings voordat
                                jy ’n nuwe funksieversoek indien.
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
                                    Geen lokaalbesprekings aangeteken nie.
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
                                    Skoolkaart
                                </p>
                                <h2 className="mt-1 text-2xl font-semibold">
                                    Ligging en lokale
                                </h2>
                                <p className="mt-2 text-sm text-zinc-500">
                                    Kies ’n ligging om die bestaande besprekings
                                    vir daardie area te sien.

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
                                                ? "Bespreekbare lokaal"
                                                : "Skoolligging"}
                                        </p>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <aside className={`${glassCard} h-fit p-5 sm:p-6`}>
                            {selectedMapLocation ? (
                                <>
                                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#d7a31f]">
                                        Gekose ligging
                                    </p>
                                    <h3 className="mt-2 text-2xl font-semibold">
                                        {selectedMapLocation.locationName}
                                    </h3>
                                    <p className="mt-1 text-sm text-zinc-500">
                                        {selectedMapLocation.locationType}
                                    </p>

                                    <div className="my-5 h-px bg-white/8" />

                                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-600">
                                        Komende besprekings
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
                                                Geen komende besprekings nie.
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
                                    Kies ’n ligging links om besonderhede te sien.
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
                                    Nuwe Logistics-versoek
                                </p>
                                <h2 className="mt-1 text-2xl font-semibold">
                                    Hoe kan ons help?
                                </h2>
                            </div>

                            <button
                                type="button"
                                disabled={submitting}
                                onClick={() => setRequestOpen(false)}
                                className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-400"
                            >
                                Sluit
                            </button>
                        </div>

                        <div className="space-y-6 p-5 sm:p-6">
                            {error && (
                                <p
                                    role="alert"
                                    className="rounded-xl border border-red-400/30 bg-red-500/5 p-3 text-sm text-red-300"
                                >
                                    {error}
                                </p>
                            )}

                            <nav
                                aria-label="Versoekstappe"
                                className="grid grid-cols-3 gap-2"
                            >
                                {["Soort versoek", "Besonderhede", "Bevestig"].map(
                                    (label, index) => (
                                        <button
                                            key={label}
                                            type="button"
                                            disabled={submitting}
                                            onClick={() => {
                                                if (index <= step) {
                                                    setStep(index);
                                                    setError("");
                                                }
                                            }}
                                            aria-current={
                                                step === index
                                                    ? "step"
                                                    : undefined
                                            }
                                            className={`rounded-xl border p-2 text-xs transition ${
                                                step === index
                                                    ? "border-[#d7a31f] bg-[#d7a31f]/8 text-[#e7b42b]"
                                                    : index < step
                                                    ? "border-white/10 bg-white/4 text-zinc-300"
                                                    : "border-white/8 text-zinc-600"
                                            }`}
                                        >
                                            {index + 1}. {label}
                                        </button>
                                    )
                                )}
                            </nav>

                            <fieldset
                                hidden={step !== 0}
                                disabled={submitting}
                                className="space-y-6"
                            >
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-[0.15em] text-zinc-500">
                                        Waarmee kan Logistics help?
                                    </p>

                                    <div className="mt-3 grid gap-3 sm:grid-cols-3">
                                        {[
                                            ["Event", "Funksie / Aktiwiteit", "Lokaal, tyd en toerusting"],
                                            ["Maintenance", "Instandhouding", "Iets moet herstel of vervang word"],
                                            ["General", "Algemeen", "Enige ander logistieke ondersteuning"],
                                            ["Security", "Sekuriteit", "Sekuriteitsversoeke en veiligheidskwessies"],
                                        ].map(([value, label, detail]) => (
                                            <button
                                                key={value}
                                                type="button"
                                                onClick={() => {
                                                    setRequestType(
                                                        value as
                                                            | "Event"
                                                            | "Maintenance"
                                                            | "General"
                                                            | "Security"
                                                    );
                                                    setError("");
                                                    setStep(1);
                                                }}
                                                className={`rounded-xl border p-4 text-left transition ${
                                                    requestType === value
                                                        ? "border-[#d7a31f]/40 bg-[#d7a31f]/10"
                                                        : "border-white/10 bg-white/4 hover:bg-white/6"
                                                }`}
                                            >
                                                <span
                                                    className={`block text-sm font-semibold ${
                                                        requestType === value
                                                            ? "text-[#e7b42b]"
                                                            : "text-zinc-200"
                                                    }`}
                                                >
                                                    {label}
                                                </span>

                                                <span className="mt-1 block text-xs leading-5 text-zinc-500">
                                                    {detail}
                                                </span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </fieldset>

                            <fieldset
                                hidden={step !== 1}
                                disabled={submitting}
                                className="space-y-6"
                            >
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-[0.15em] text-[#d7a31f]">
                                        {displayLabel(requestType)}
                                    </p>

                                    <h3 className="mt-2 text-lg font-semibold">
                                        {requestType === "Event"
                                            ? "Funksie- of aktiwiteitsbesonderhede"
                                            : requestType === "Maintenance"
                                            ? "Wat benodig aandag?"
                                            : requestType === "Security"
                                            ? "Sekuriteitsversoek"
                                            : "Wat benodig jy?"}
                                    </h3>

                                    <p className="mt-1 text-sm text-zinc-500">
                                        Jou naam, e-pos, datum van indiening,
                                        interne status en prioriteit word
                                        outomaties deur NKRN hanteer.
                                    </p>
                                </div>

                                {requestType === "Event" && (
                                    <div>
                                        <label className="mb-3 block text-xs font-semibold uppercase tracking-[0.15em] text-zinc-500">
                                            Aktiwiteitskategorie
                                        </label>

                                        <div className="flex flex-wrap gap-2">
                                            {referenceData.activityCategories.map(
                                                (category) => (
                                                    <button
                                                        key={category}
                                                        type="button"
                                                        onClick={() =>
                                                            setActivityCategory(
                                                                category
                                                            )
                                                        }
                                                        className={`rounded-xl border px-3 py-2 text-sm transition ${
                                                            activityCategory ===
                                                            category
                                                                ? "border-[#d7a31f]/35 bg-[#d7a31f]/10 text-[#e7b42b]"
                                                                : "border-white/8 bg-white/3 text-zinc-400"
                                                        }`}
                                                    >
                                                        {displayLabel(category)}
                                                    </button>
                                                )
                                            )}
                                        </div>
                                    </div>
                                )}

                                <div>
                                    <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.15em] text-zinc-500">
                                        {requestType === "Event"
                                            ? "Wat reël jy en wat moet Logistics weet?"
                                            : requestType === "Maintenance"
                                            ? "Wat is fout of wat moet gedoen word?"
                                            : requestType === "Security"
                                            ? "Beskryf die veiligheidskwessie, risiko of sekuriteitsondersteuning wat benodig word."
                                            : "Waarmee kan Logistics help?"}
                                    </label>

                                    <textarea
                                        value={description}
                                        onChange={(event) =>
                                            setDescription(event.target.value)
                                        }
                                        rows={4}
                                        placeholder={
                                            requestType === "Event"
                                                ? "bv. Graad 5-oueraand. Ons benodig die saal gereed voor 17:30."
                                                : requestType === "Maintenance"
                                                ? "bv. Die venster in Graad 5A sluit nie en moet nagegaan word."
                                                : requestType === "Security"
                                                ? "Beskryf die veiligheidskwessie en waar/wanneer dit gebeur."
                                                : "Beskryf kortliks wat jy benodig."
                                        }
                                        className={`${inputClass} resize-none`}
                                    />
                                </div>
                                <ItAiAssistant
                                    moduleKey="Logistics"
                                    description={description}
                                    additionalContext={`Soort: ${requestType}; Ligging: ${
                                        customLocation || locationID || "Nie gekies nie"
                                    }; Datum: ${activityDate || "Nie gekies nie"}`}
                                    disabled={submitting}
                                    onSessionStarted={setAiSessionID}
                                    onSuggestedRequestType={(value) =>
                                        setRequestType(value)
                                    }
                                    onSuggestedCategory={(value) => {
                                        const match =
                                            referenceData.maintenance.find(
                                                (item) =>
                                                    item.maintenanceName.toLowerCase() ===
                                                    value.toLowerCase()
                                            );

                                        if (match) {
                                            setMaintenanceTypeID(
                                                String(match.maintenanceTypeID)
                                            );
                                            setRequestType("Maintenance");
                                        }
                                    }}
                                    onResolved={() => {
                                        setRequestOpen(false);
                                        resetRequestForm();
                                        setSuccess(
                                            "Goed, geen Logistieke versoek is nodig nie."
                                        );
                                    }}
                                    onLogRequest={() => {
                                        void submitRequest();
                                    }}
                                />

                                <div>
                                    <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.15em] text-zinc-500">
                                        Lokaal / ligging
                                        <span className="ml-1 normal-case tracking-normal text-zinc-600">
                                            (indien van toepassing)
                                        </span>
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
                                        <option value="">
                                            Kies ’n ligging…
                                        </option>

                                        {referenceData.locations.map(
                                            (location) => (
                                                <option
                                                    key={
                                                        location.locationID
                                                    }
                                                    value={String(
                                                        location.locationID
                                                    )}
                                                >
                                                    {location.locationName}
                                                </option>
                                            )
                                        )}
                                    </select>

                                    {!locationID && (
                                        <input
                                            value={customLocation}
                                            onChange={(event) =>
                                                setCustomLocation(
                                                    event.target.value
                                                )
                                            }
                                            placeholder="Of tik ’n klaskamer / gebied wat nie op die lys is nie"
                                            className={`${inputClass} mt-3`}
                                        />
                                    )}
                                </div>

                                {requestType === "Event" && (
                                    <>
                                        <div className="grid gap-4 sm:grid-cols-3">
                                            <div>
                                                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.15em] text-zinc-500">
                                                    Datum
                                                </label>

                                                <input
                                                    type="date"
                                                    min={todayISO()}
                                                    value={activityDate}
                                                    onChange={(event) => {
                                                        setActivityDate(
                                                            event.target.value
                                                        );
                                                        setAvailabilityMessage(
                                                            ""
                                                        );
                                                        setAvailabilityOkay(
                                                            null
                                                        );
                                                    }}
                                                    className={inputClass}
                                                />
                                            </div>

                                            <div>
                                                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.15em] text-zinc-500">
                                                    Begintyd
                                                </label>

                                                <input
                                                    type="time"
                                                    value={startTime}
                                                    onChange={(event) => {
                                                        setStartTime(
                                                            event.target.value
                                                        );
                                                        setAvailabilityMessage(
                                                            ""
                                                        );
                                                        setAvailabilityOkay(
                                                            null
                                                        );
                                                    }}
                                                    className={inputClass}
                                                />
                                            </div>

                                            <div>
                                                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.15em] text-zinc-500">
                                                    Eindtyd
                                                </label>

                                                <input
                                                    type="time"
                                                    value={endTime}
                                                    onChange={(event) => {
                                                        setEndTime(
                                                            event.target.value
                                                        );
                                                        setAvailabilityMessage(
                                                            ""
                                                        );
                                                        setAvailabilityOkay(
                                                            null
                                                        );
                                                    }}
                                                    className={inputClass}
                                                />
                                            </div>
                                        </div>

                                        {locationID &&
                                            activityDate &&
                                            startTime &&
                                            endTime && (
                                                <div className="rounded-xl border border-white/8 bg-white/3 p-4">
                                                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                                        <div>
                                                            <p className="text-sm font-medium">
                                                                Lokaalbeskikbaarheid
                                                            </p>

                                                            <p
                                                                className={`mt-1 text-xs ${
                                                                    availabilityOkay ===
                                                                    true
                                                                        ? "text-green-300"
                                                                        : availabilityOkay ===
                                                                          false
                                                                        ? "text-red-300"
                                                                        : "text-zinc-500"
                                                                }`}
                                                            >
                                                                {availabilityMessage ||
                                                                    "NKRN kan die lokaal teen bestaande besprekings kontroleer."}
                                                            </p>
                                                        </div>

                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                void checkAvailability()
                                                            }
                                                            disabled={
                                                                checkingAvailability
                                                            }
                                                            className="rounded-xl border border-white/10 bg-white/6 px-4 py-2.5 text-sm text-zinc-300 disabled:opacity-40"
                                                        >
                                                            {checkingAvailability
                                                                ? "Besig om te kontroleer…"
                                                                : "Kontroleer"}
                                                        </button>
                                                    </div>
                                                </div>
                                            )}

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
                                                Opruiming word die volgende
                                                oggend benodig
                                            </span>
                                        </label>

                                        {referenceData.equipment.length > 0 && (
                                            <div>
                                                <label className="mb-3 block text-xs font-semibold uppercase tracking-[0.15em] text-zinc-500">
                                                    Benodigde toerusting
                                                    <span className="ml-1 normal-case tracking-normal text-zinc-600">
                                                        (opsioneel)
                                                    </span>
                                                </label>

                                                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                                                    {referenceData.equipment.map(
                                                        (item) => {
                                                            const selected =
                                                                selectedEquipment.includes(
                                                                    item.equipmentTypeID
                                                                );

                                                            return (
                                                                <button
                                                                    key={
                                                                        item.equipmentTypeID
                                                                    }
                                                                    type="button"
                                                                    onClick={() =>
                                                                        setSelectedEquipment(
                                                                            (
                                                                                current
                                                                            ) =>
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
                                                                    className={`rounded-xl border p-3 text-left text-sm transition ${
                                                                        selected
                                                                            ? "border-[#d7a31f]/30 bg-[#d7a31f]/8 text-zinc-200"
                                                                            : "border-white/8 bg-white/3 text-zinc-400"
                                                                    }`}
                                                                >
                                                                    {selected
                                                                        ? "✓ "
                                                                        : ""}
                                                                    {
                                                                        item.equipmentName
                                                                    }
                                                                </button>
                                                            );
                                                        }
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </>
                                )}

                                {requestType === "Maintenance" && (
                                    <>
                                        <div>
                                            <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.15em] text-zinc-500">
                                                Wat benodig aandag?
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
                                                    Kies ’n item…
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
                                                            {
                                                                item.maintenanceName
                                                            }
                                                        </option>
                                                    )
                                                )}
                                            </select>
                                        </div>

                                        <div>
                                            <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.15em] text-zinc-500">
                                                Wat moet gebeur?
                                            </label>

                                            <div className="grid gap-3 sm:grid-cols-3">
                                                {[
                                                    ["Repair", "Herstel"],
                                                    ["Replace", "Vervang"],
                                                    ["Unsure", "Onseker"],
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

                                <div className="flex flex-col-reverse gap-3 border-t border-white/8 pt-5 sm:flex-row sm:justify-between">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setError("");
                                            setStep(0);
                                        }}
                                        className="q4-nav"
                                    >
                                        ← Soort versoek
                                    </button>

                                    <button
                                        type="button"
                                        onClick={continueToReview}
                                        className="rounded-xl bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-zinc-200"
                                    >
                                        Kontroleer versoek
                                    </button>
                                </div>
                            </fieldset>

                            <fieldset
                                hidden={step !== 2}
                                disabled={submitting}
                                className="space-y-6"
                            >
                                <div className="rounded-2xl border border-[#d7a31f]/30 bg-[#d7a31f]/5 p-5">
                                    <p className="text-xs font-semibold uppercase tracking-[0.15em] text-[#d7a31f]">
                                        {displayLabel(requestType)}
                                    </p>

                                    <h3 className="mt-2 text-lg font-semibold">
                                        Kontroleer jou versoek
                                    </h3>

                                    <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-zinc-300">
                                        {description}
                                    </p>

                                    {(locationID ||
                                        customLocation.trim()) && (
                                        <p className="mt-3 text-sm text-zinc-400">
                                            <span className="text-zinc-600">
                                                Ligging:{" "}
                                            </span>
                                            {referenceData.locations.find(
                                                (item) =>
                                                    String(
                                                        item.locationID
                                                    ) === locationID
                                            )?.locationName ||
                                                customLocation}
                                        </p>
                                    )}

                                    {requestType === "Event" && (
                                        <div className="mt-3 space-y-2 text-sm text-zinc-400">
                                            <p>
                                                <span className="text-zinc-600">
                                                    Kategorie:{" "}
                                                </span>
                                                {displayLabel(
                                                    activityCategory
                                                )}
                                            </p>

                                            <p>
                                                <span className="text-zinc-600">
                                                    Wanneer:{" "}
                                                </span>
                                                {displayDate(
                                                    activityDate
                                                )}{" "}
                                                · {startTime} – {endTime}
                                            </p>

                                            <p>
                                                <span className="text-zinc-600">
                                                    Opruiming volgende oggend:{" "}
                                                </span>
                                                {cleanupNextDay
                                                    ? "Ja"
                                                    : "Nee"}
                                            </p>

                                            {selectedEquipment.length >
                                                0 && (
                                                <p>
                                                    <span className="text-zinc-600">
                                                        Toerusting:{" "}
                                                    </span>
                                                    {referenceData.equipment
                                                        .filter((item) =>
                                                            selectedEquipment.includes(
                                                                item.equipmentTypeID
                                                            )
                                                        )
                                                        .map(
                                                            (item) =>
                                                                item.equipmentName
                                                        )
                                                        .join(", ")}
                                                </p>
                                            )}

                                            {availabilityMessage && (
                                                <p
                                                    className={
                                                        availabilityOkay ===
                                                        false
                                                            ? "text-red-300"
                                                            : availabilityOkay ===
                                                              true
                                                            ? "text-green-300"
                                                            : "text-zinc-500"
                                                    }
                                                >
                                                    {availabilityMessage}
                                                </p>
                                            )}
                                        </div>
                                    )}

                                    {requestType === "Maintenance" && (
                                        <p className="mt-3 text-sm text-zinc-400">
                                            <span className="text-zinc-600">
                                                Aandag:{" "}
                                            </span>
                                            {referenceData.maintenance.find(
                                                (item) =>
                                                    String(
                                                        item.maintenanceTypeID
                                                    ) === maintenanceTypeID
                                            )?.maintenanceName ||
                                                "Nie gekies nie"}{" "}
                                            ·{" "}
                                            {displayLabel(
                                                maintenanceAction
                                            )}
                                        </p>
                                    )}
                                </div>

                                <div className="rounded-xl border border-white/8 bg-white/3 p-4">
                                    <p className="text-xs uppercase tracking-wide text-zinc-600">
                                        Ingedien deur
                                    </p>

                                    <p className="mt-1 text-sm font-medium text-zinc-200">
                                        {user.firstName} {user.lastName}
                                    </p>

                                    <p className="text-xs text-zinc-600">
                                        {user.email}
                                    </p>

                                    <p className="mt-2 text-xs leading-5 text-zinc-600">
                                        NKRN koppel jou identiteit en die
                                        indieningstyd outomaties. Die
                                        Logistics-span bepaal interne
                                        prioriteit, status en toewysing.
                                    </p>
                                </div>

                                <div className="flex flex-col-reverse gap-3 border-t border-white/8 pt-5 sm:flex-row sm:justify-between">
                                    <button
                                        type="button"
                                        disabled={submitting}
                                        onClick={() => {
                                            setError("");
                                            setStep(1);
                                        }}
                                        className="q4-nav"
                                    >
                                        ← Wysig
                                    </button>

                                    <button
                                        type="button"
                                        disabled={submitting}
                                        onClick={() =>
                                            void submitRequest()
                                        }
                                        className="rounded-xl border border-[#d7a31f]/35 bg-[#d7a31f]/12 px-5 py-3 text-sm font-semibold text-[#e7b42b] transition hover:bg-[#d7a31f]/18 disabled:opacity-50"
                                    >
                                        {submitting
                                            ? "Besig om in te dien…"
                                            : "Dien Logistics-versoek in"}
                                    </button>
                                </div>
                            </fieldset>
                        </div>
                    </div>
                </div>
            )}
        </main>
    );
}
