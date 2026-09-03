"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import LogoutButton from "./components/LogoutButton";
import "./nkrn-control.css";

interface LoggedInUser {
    userID: number;
    firstName: string;
    lastName: string;
    email: string;
    roleID: number;
}

interface ModuleDefinition {
    key: string;
    name: string;
    shortName: string;
    description: string;
    status: "active" | "coming-soon";
    eyebrow: string;
}

const modules: ModuleDefinition[] = [
    {
        key: "it",
        name: "IT Help (Report)",
        shortName: "IT",
        description:
            "Log support requests, track incidents, manage assignments and administer technical support.",
        status: "active",
        eyebrow: "Support & Systems",
    },
    {
        key: "logistics",
        name: "Logistics",
        shortName: "LG",
        description:
            "Coordinate operational requests, resources, facilities and day-to-day school logistics.",
        status: "active",
        eyebrow: "Operations",
    },
    {
        key: "transport",
        name: "Transport",
        shortName: "TR",
        description:
            "Manage transport requests, vehicle planning, bookings and school movement requirements.",
        status: "coming-soon",
        eyebrow: "Mobility",
    },
    {
        key: "curriculum",
        name: "Curriculum",
        shortName: "CU",
        description:
            "Centralise curriculum tools, planning resources, academic workflows and teaching support.",
        status: "coming-soon",
        eyebrow: "Academic",
    },
    {
        key: "venues",
        name: "Venues",
        shortName: "VN",
        description:
            "Coordinate venue availability, bookings and shared-space scheduling across the school.",
        status: "coming-soon",
        eyebrow: "Facilities",
    },
    {
        key: "events",
        name: "Events",
        shortName: "EV",
        description:
            "Plan events, responsibilities, resources, communications and operational requirements.",
        status: "coming-soon",
        eyebrow: "Coordination",
    },
];

function getRoleName(roleID: number) {
    switch (roleID) {
        case 3:
            return "Administrator";
        case 2:
            return "Technician";
        default:
            return "Staff Member";
    }
}

function ModuleIcon({
    moduleKey,
}: {
    moduleKey: string;
}) {
    const common =
        "h-6 w-6 fill-none stroke-current stroke-[1.7]";

    switch (moduleKey) {
        case "it":
            return (
                <svg
                    viewBox="0 0 24 24"
                    className={common}
                    aria-hidden="true"
                >
                    <rect
                        x="4"
                        y="5"
                        width="16"
                        height="11"
                        rx="2"
                    />
                    <path d="M8 20h8M12 16v4M8 9h8M8 12h5" />
                </svg>
            );

        case "logistics":
            return (
                <svg
                    viewBox="0 0 24 24"
                    className={common}
                    aria-hidden="true"
                >
                    <path d="M4 7h10v10H4zM14 10h3l3 3v4h-6z" />
                    <circle cx="8" cy="18" r="1.5" />
                    <circle cx="17" cy="18" r="1.5" />
                </svg>
            );

        case "transport":
            return (
                <svg
                    viewBox="0 0 24 24"
                    className={common}
                    aria-hidden="true"
                >
                    <path d="M5 6h14v11H5zM7 3h10v3M5 11h14" />
                    <circle cx="8" cy="18" r="1.5" />
                    <circle cx="16" cy="18" r="1.5" />
                </svg>
            );

        case "curriculum":
            return (
                <svg
                    viewBox="0 0 24 24"
                    className={common}
                    aria-hidden="true"
                >
                    <path d="M4 5.5A3.5 3.5 0 0 1 7.5 2H12v17H7.5A3.5 3.5 0 0 0 4 22z" />
                    <path d="M20 5.5A3.5 3.5 0 0 0 16.5 2H12v17h4.5A3.5 3.5 0 0 1 20 22z" />
                </svg>
            );

        case "venues":
            return (
                <svg
                    viewBox="0 0 24 24"
                    className={common}
                    aria-hidden="true"
                >
                    <path d="M4 21V8l8-5 8 5v13M8 21v-6h8v6M9 10h.01M15 10h.01" />
                </svg>
            );

        default:
            return (
                <svg
                    viewBox="0 0 24 24"
                    className={common}
                    aria-hidden="true"
                >
                    <rect
                        x="3"
                        y="5"
                        width="18"
                        height="16"
                        rx="2"
                    />
                    <path d="M8 3v4M16 3v4M3 10h18M8 14h2M14 14h2M8 17h2" />
                </svg>
            );
    }
}

export default function Home() {
    const router = useRouter();

    const [user, setUser] =
        useState<LoggedInUser | null>(null);

    const [loading, setLoading] =
        useState(true);

    useEffect(() => {
        let cancelled = false;

        const loadUser = () => {
            const token =
                localStorage.getItem("token");

            const storedUser =
                localStorage.getItem("user");

            if (!token || !storedUser) {
                router.replace("/login");
                return;
            }

            try {
                const loggedInUser: LoggedInUser =
                    JSON.parse(storedUser);

                if (!cancelled) {
                    setUser(loggedInUser);
                }
            } catch (error) {
                console.error(
                    "Unable to read logged-in user.",
                    error
                );

                localStorage.removeItem("token");
                localStorage.removeItem("user");

                router.replace("/login");
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        };

        loadUser();

        return () => {
            cancelled = true;
        };
    }, [router]);

    function openITDesk() {
        if (!user) {
            return;
        }

        if (user.roleID === 3) {
            router.push("/Admin");
            return;
        }

        if (user.roleID === 2) {
            router.push("/Tech");
            return;
        }

        router.push("/requests");
    }

    function openModule(module: ModuleDefinition) {
        if (module.key === "it") {
            openITDesk();
            return;
        }

        if (module.key === "logistics") {
            router.push("/Logistics");
        }
    }

    if (loading) {
        return (
            <main className="nkrn-control relative flex min-h-screen items-center justify-center overflow-hidden bg-zinc-950 text-white">
                <div className="nkrn-panel relative px-8 py-7 text-center">
                    <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/6 backdrop-blur-xl">
                        <div className="h-3 w-3 animate-pulse rounded-full bg-[#e7b42b]" />
                    </div>

                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500">
                        NKRN
                    </p>

                    <p className="mt-2 text-sm text-zinc-300">
                        Loading workspace...
                    </p>
                </div>
            </main>
        );
    }

    if (!user) {
        return null;
    }

    return (
        <main className="nkrn-control relative min-h-screen overflow-hidden bg-zinc-950 text-white">
            <div className="pointer-events-none fixed inset-0 overflow-hidden">
                <div className="absolute -left-40 -top-40 h-136 w-136 rounded-full bg-white/[0.035] blur-3xl" />
                <div className="absolute -right-40 top-1/4 h-152 w-152 rounded-full bg-[#d7a31f]/[0.035] blur-3xl" />
                <div className="absolute -bottom-72 left-1/3 h-136 w-136 rounded-full bg-white/2.5 blur-3xl" />
            </div>

            <div className="relative z-10 mx-auto w-full max-w-7xl px-5 py-6 sm:px-8 lg:px-10 lg:py-8">
                <header className="nkrn-panel mb-8 overflow-hidden">
                    <div className="flex flex-col gap-6 border-b border-white/[0.07] px-5 py-5 sm:px-7 lg:flex-row lg:items-center lg:justify-between">
                        <div className="flex min-w-0 items-center gap-4">
                            <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl">
                                <Image
                                    src="/wit-logo-tygies.png"
                                    alt="Laerskool Tygerpoort"
                                    width={130}
                                    height={52}
                                    className="h-auto w-24 object-contain"
                                    priority
                                />
                            </div>

                            <div className="min-w-0">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#d7a31f]">
                                    Laerskool Tygerpoort
                                </p>

                                <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                                    <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
                                        School Operations Platform
                                    </h1>
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-3">
                            <div className="hidden border-r border-white/10 pr-4 text-right md:block">
                                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-600">
                                    Signed in
                                </p>

                                <p className="mt-1 text-sm font-medium text-zinc-200">
                                    {user.firstName}{" "}
                                    {user.lastName}
                                </p>

                                <p className="text-xs text-zinc-500">
                                    {getRoleName(user.roleID)}
                                </p>
                            </div>

                            <LogoutButton />
                        </div>
                    </div>

                    <nav
                        className="flex gap-2 overflow-x-auto px-4 py-3 sm:px-6"
                        aria-label="NKRN modules"
                    >
                        <button
                            type="button"
                            className="shrink-0 rounded-xl border border-[#d7a31f]/25 bg-[#d7a31f]/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#e7b42b]"
                        >
                            Home
                        </button>

                        {modules.map((module) => (
                            <button
                                key={module.key}
                                type="button"
                                onClick={() =>
                                    openModule(module)
                                }
                                disabled={
                                    module.status !==
                                    "active"
                                }
                                className={`shrink-0 rounded-xl border px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] transition ${
                                    module.status ===
                                    "active"
                                        ? "border-white/10 bg-white/4.5 text-zinc-300 hover:border-[#d7a31f]/30 hover:bg-[#d7a31f]/8 hover:text-[#e7b42b]"
                                        : "cursor-not-allowed border-white/5 bg-white/2 text-zinc-700"
                                }`}
                            >
                                {module.name}
                            </button>
                        ))}
                    </nav>
                </header>

                <section className="nkrn-panel nkrn-hero mb-8 overflow-hidden p-6 sm:p-8 lg:p-10">
                    <div className="grid gap-8 lg:grid-cols-[1.4fr_0.6fr] lg:items-end">
                        <div>
                            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.24em] text-[#d7a31f]">
                                Unified School Workspace
                            </p>

                            <h2 className="max-w-4xl text-4xl font-extrabold leading-[0.98] tracking-[-0.035em] text-white sm:text-5xl lg:text-6xl">
                                One platform.
                                <br />
                                Every operation.
                            </h2>

                            <p className="mt-5 max-w-2xl text-base leading-7 text-zinc-400 sm:text-lg">
                                Welcome, {user.firstName}.
                                NKRN brings the school&apos;s
                                operational systems into one
                                secure workspace. Choose a
                                module below to continue.
                            </p>
                        </div>

                        <div className="rounded-2xl border border-white/10 bg-black/20 p-5 backdrop-blur-xl">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-600">
                                Platform Status
                            </p>

                            <div className="mt-4 flex items-center justify-between gap-4">
                                <div>
                                    <p className="text-3xl font-bold text-white">
                                        2
                                    </p>

                                    <p className="mt-1 text-xs text-zinc-500">
                                        Active modules
                                    </p>
                                </div>

                                <div className="h-10 w-px bg-white/10" />

                                <div className="text-right">
                                    <p className="text-sm font-semibold text-[#e7b42b]">
                                        IT Desk · Logistics
                                    </p>

                                    <p className="mt-1 text-xs text-zinc-500">
                                        Operational
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                <section>
                    <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-600">
                                Modules
                            </p>

                            <h2 className="mt-1 text-2xl font-bold tracking-tight">
                                NKRN Workspace
                            </h2>
                        </div>

                        <p className="max-w-xl text-sm text-zinc-500">
                            IT Desk and Logistics are live.
                            Additional NKRN modules will be
                            enabled here as they are developed.
                        </p>
                    </div>

                    <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                        {modules.map((module) => {
                            const active =
                                module.status ===
                                "active";

                            return (
                                <button
                                    key={module.key}
                                    type="button"
                                    onClick={() =>
                                        openModule(module)
                                    }
                                    disabled={!active}
                                    className={`group relative overflow-hidden rounded-[26px] border p-6 text-left backdrop-blur-2xl transition duration-300 ${
                                        active
                                            ? "cursor-pointer border-[#d7a31f]/20 bg-white/5.5 shadow-2xl shadow-black/20 hover:-translate-y-1 hover:border-[#d7a31f]/45 hover:bg-white/7.5"
                                            : "cursor-not-allowed border-white/[0.07] bg-white/2.5 opacity-70"
                                    }`}
                                >
                                    {active && (
                                        <div className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-[#e7b42b]/70 to-transparent" />
                                    )}

                                    <div className="flex items-start justify-between gap-5">
                                        <div
                                            className={`flex h-12 w-12 items-center justify-center rounded-2xl border ${
                                                active
                                                    ? "border-[#d7a31f]/25 bg-[#d7a31f]/10 text-[#e7b42b]"
                                                    : "border-white/10 bg-white/4 text-zinc-600"
                                            }`}
                                        >
                                            <ModuleIcon
                                                moduleKey={
                                                    module.key
                                                }
                                            />
                                        </div>

                                        <span
                                            className={`rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.15em] ${
                                                active
                                                    ? "border-green-400/15 bg-green-500/8 text-green-300"
                                                    : "border-white/6 bg-white/2.5 text-zinc-600"
                                            }`}
                                        >
                                            {active
                                                ? "Live"
                                                : "Coming Soon"}
                                        </span>
                                    </div>

                                    <p className="mt-7 text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-600">
                                        {module.eyebrow}
                                    </p>

                                    <div className="mt-1 flex items-end justify-between gap-4">
                                        <div>
                                            <h3 className="text-2xl font-bold tracking-tight text-white">
                                                {
                                                    module.name
                                                }
                                            </h3>

                                            <p className="mt-3 max-w-md text-sm leading-6 text-zinc-500">
                                                {
                                                    module.description
                                                }
                                            </p>
                                        </div>

                                        <span
                                            className={`mb-1 text-2xl transition ${
                                                active
                                                    ? "text-[#d7a31f] group-hover:translate-x-1"
                                                    : "text-zinc-800"
                                            }`}
                                            aria-hidden="true"
                                        >
                                            →
                                        </span>
                                    </div>

                                    {active && (
                                        <div className="mt-6 flex items-center justify-between border-t border-white/[0.07] pt-4">
                                            <span className="text-xs font-medium text-zinc-400">
                                                {module.key === "it"
                                                    ? "Open full IT Desk"
                                                    : "Open Logistics"}
                                            </span>

                                            <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#e7b42b]">
                                                Available
                                            </span>
                                        </div>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </section>

                <footer className="mt-12 flex flex-col gap-3 border-t border-white/[0.07] py-6 text-xs text-zinc-600 sm:flex-row sm:items-center sm:justify-between">
                    <p>
                        Laerskool Tygerpoort · Secure school operations workspace
                    </p>

                    <p className="font-semibold tracking-wide text-zinc-500">
                        NKRN™ ©
                    </p>
                </footer>
            </div>
        </main>
    );
}
