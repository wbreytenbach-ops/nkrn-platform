"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import LogoutButton from "./components/LogoutButton";
import { useLanguage } from "./language";
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
    { key: "it", name: "IT Report", shortName: "IT", description: "Meld tegniese probleme aan en volg jou ondersteuningsversoeke.", status: "active", eyebrow: "Ondersteuning" },
    { key: "logistics", name: "Logistics", shortName: "LG", description: "Versoeke, aktiwiteite, instandhouding, lokale en die daaglikse werkplan.", status: "active", eyebrow: "Skoolbedryf" },
    { key: "funksieversorging", name: "Funksieversorging", shortName: "FV", description: "Berei funksies voor: versorging, tafeldekking en benodigdhede.", status: "active", eyebrow: "Funksievoorbereiding" },
    { key: "transport", name: "Transport", shortName: "TR", description: "Vervoer en reisbeplanning.", status: "coming-soon", eyebrow: "Toekomstige module" },
    { key: "curriculum", name: "Curriculum", shortName: "CU", description: "Kurrikulum en onderrigbeplanning.", status: "coming-soon", eyebrow: "Toekomstige module" },
];

function getRoleName(roleID: number) {
    switch (roleID) {
        case 3:
            return "Administrateur";
        case 2:
            return "Tegnikus";
        default:
            return "Personeellid";
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
    const { language, t } = useLanguage();

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

        if (module.key === "funksieversorging") router.push("/Funksieversorging");
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
                        Werksruimte laai...
                    </p>
                </div>
            </main>
        );
    }

    if (!user) {
        return null;
    }

    return (
        <main className="nkrn-control q4-home min-h-screen text-white">
            <div className="relative z-10 mx-auto max-w-7xl px-5 py-8 sm:px-8">
                <header className="nkrn-panel p-5 sm:p-7">
                    <div className="flex flex-wrap items-center justify-between gap-5">
                        <div className="flex items-center gap-4">
                            <Image src="/wit-logo-tygies.png" alt="Laerskool Tygerpoort" width={130} height={52} priority />
                            <div><p className="text-xs uppercase tracking-[.2em] text-[#e7b42b]">Laerskool Tygerpoort</p><h1 className="mt-2 text-2xl font-bold">Skoolbedryfsplatform</h1></div>
                        </div>
                        <div className="flex items-center gap-4"><div className="text-right text-sm"><p className="text-zinc-400">Aangemeld</p><p>{user.firstName} {user.lastName}</p><p className="text-zinc-400">{t(getRoleName(user.roleID))}</p></div><LogoutButton /></div>
                    </div>
                    <nav aria-label="Hoofnavigasie" className="mt-6 flex flex-wrap gap-2 border-t border-white/10 pt-4">
                        <button type="button" aria-current="page" className="q4-nav">Tuis</button>
                        {modules.map(module => <button type="button" className="q4-nav" key={module.key} disabled={module.status !== "active"} onClick={() => openModule(module)}>{t(module.name)}</button>)}
                    </nav>
                </header>
                <section className="py-12 sm:py-16">
                    <p className="text-sm uppercase tracking-[.2em] text-[#e7b42b]">Jou skool. Jou werksruimte.</p>
                    <h2 className="mt-4 max-w-3xl text-4xl font-bold tracking-tight sm:text-6xl">Elke dag se werk,<br />op een plek.</h2>
                    <p className="mt-5 text-lg text-zinc-300">
                        {language === "af"
                            ? `Welkom, ${user.firstName}. Kies ’n module om aan die gang te kom.`
                            : `Welcome, ${user.firstName}. Choose a module to get started.`}
                    </p>
                    <p className="mt-6 inline-flex rounded-full border border-[#d7a31f]/30 bg-[#d7a31f]/10 px-5 py-2 text-sm text-[#e7b42b]">
                        {language === "af"
                            ? "3 aktiewe modules · 2 toekomstige modules"
                            : "3 active modules · 2 future modules"}
                    </p>
                </section>
                <section aria-labelledby="active-modules">
                    <h2 id="active-modules" className="mb-5 text-xl font-semibold">Aktiewe modules</h2>
                    <div className="grid gap-5 md:grid-cols-3">{modules.filter(module => module.status === "active").map(module => (
                        <button key={module.key} type="button" onClick={() => openModule(module)} className="q4-module nkrn-panel group p-7 text-left">
                            <div className="flex items-center justify-between"><ModuleIcon moduleKey={module.key} /><span className="text-xs text-[#e7b42b]">In werking</span></div>
                            <p className="mt-8 text-xs uppercase tracking-widest text-zinc-400">{t(module.eyebrow)}</p>
                            <h3 className="mt-2 text-2xl font-bold">{t(module.name)}</h3><p className="mt-3 min-h-20 text-sm leading-6 text-zinc-300">{t(module.description)}</p>
                            <span className="mt-6 block text-sm text-[#e7b42b]">Maak oop →</span>
                        </button>
                    ))}</div>
                </section>
                <section className="mt-12 border-t border-white/10 pt-7" aria-labelledby="future-modules">
                    <h2 id="future-modules" className="mb-4 text-lg font-semibold text-zinc-300">Toekomstige modules</h2>
                    <div className="grid gap-4 sm:grid-cols-2">{modules.filter(module => module.status !== "active").map(module => (
                        <button key={module.key} type="button" disabled className="flex cursor-not-allowed items-center justify-between rounded-2xl border border-white/10 bg-white/3 p-5 text-left"><span><span className="block font-semibold">{t(module.name)}</span><span className="mt-1 block text-sm text-zinc-400">{t(module.description)}</span></span><span className="ml-3 text-xs text-zinc-400">Binnekort</span></button>
                    ))}</div>
                </section>
            </div>
        </main>
    );
}
