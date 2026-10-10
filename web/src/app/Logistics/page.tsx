"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import LogisticsManagementDashboard from "./LogisticsManagementDashboard";
import LogisticsSecurityPortal from "./LogisticsSecurityPortal";
import LogisticsTeacherPortal from "./LogisticsTeacherPortal";
import "../nkrn-control.css";

interface NKRNUser {
    userID: number;
    firstName: string;
    lastName: string;
    email: string;
    roleID: number;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL;

function authHeaders(): HeadersInit {
    const token = localStorage.getItem("token");

    return {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
}

export default function LogisticsPage() {
    const router = useRouter();

    const [user, setUser] = useState<NKRNUser | null>(null);
    const [checkingAccess, setCheckingAccess] = useState(true);
    const [managementAccess, setManagementAccess] = useState(false);
    const [adminRequestMode, setAdminRequestMode] = useState(false);
    const [securityAccess, setSecurityAccess] = useState(false);
    const [securityView, setSecurityView] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        let cancelled = false;

        async function checkAccess() {
            try {
                const token = localStorage.getItem("token");
                const storedUser = localStorage.getItem("user");

                if (!token || !storedUser) {
                    router.replace("/login");
                    return;
                }

                const loggedInUser = JSON.parse(storedUser) as NKRNUser;

                if (cancelled) {
                    return;
                }

                setUser(loggedInUser);

                // Security contact receives a read-only Security-only workspace.
                if (
                    loggedInUser.email?.trim().toLowerCase() ===
                    "jwerner@tygies.co.za"
                ) {
                    setSecurityAccess(true);
                    return;
                }

                // NKRN-admins retain their management permissions.
                if (loggedInUser.roleID === 3) {
                    setManagementAccess(true);
                    return;
                }

                // This endpoint already respects Logistics ModulePermissions.
                // Keep the existing access-control logic unchanged.
                const response = await fetch(
                    `${API_URL}/api/LogisticsTasks?includeArchived=false`,
                    {
                        headers: authHeaders(),
                        cache: "no-store",
                    }
                );

                if (response.status === 401) {
                    localStorage.removeItem("token");
                    localStorage.removeItem("user");
                    router.replace("/login");
                    return;
                }

                if (cancelled) {
                    return;
                }

                if (response.ok) {
                    setManagementAccess(true);
                    return;
                }

                if (response.status === 403) {
                    setManagementAccess(false);
                    return;
                }

                throw new Error(
                    `Kon nie Logistiek-toegang bepaal nie (${response.status}).`
                );
            } catch (accessError) {
                console.error(
                    "Kon nie Logistiek-toegang bepaal nie:",
                    accessError
                );

                if (!cancelled) {
                    setError(
                        accessError instanceof Error
                            ? accessError.message
                            : "Kon nie Logistiek oopmaak nie."
                    );
                }
            } finally {
                if (!cancelled) {
                    setCheckingAccess(false);
                }
            }
        }

        void checkAccess();

        return () => {
            cancelled = true;
        };
    }, [router]);

    if (checkingAccess) {
        return (
            <main className="nkrn-control flex min-h-screen items-center justify-center bg-zinc-950 text-white">
                <div className="nkrn-panel rounded-[28px] border border-white/10 bg-white/4 px-8 py-7 text-center shadow-2xl shadow-black/20 backdrop-blur-2xl">
                    <div className="mx-auto mb-4 h-3 w-3 animate-pulse rounded-full bg-[#e7b42b]" />

                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#d7a31f]">
                        Logistiek
                    </p>

                    <p className="mt-2 text-sm text-zinc-400">
                        Jou werkruimte word oopgemaak…
                    </p>
                </div>
            </main>
        );
    }

    if (error) {
        return (
            <main className="nkrn-control flex min-h-screen items-center justify-center bg-zinc-950 px-5 text-white">
                <div className="nkrn-panel max-w-lg rounded-[28px] border border-red-400/15 bg-white/4 p-8 text-center">
                    <p className="text-sm text-red-300">{error}</p>

                    <button
                        type="button"
                        onClick={() => router.push("/")}
                        className="mt-5 rounded-xl border border-white/10 bg-white/6 px-4 py-2.5 text-sm text-zinc-200 transition hover:bg-white/10"
                    >
                        Terug na NKRN
                    </button>
                </div>
            </main>
        );
    }

    if (!user) {
        return null;
    }

    if (securityAccess && securityView) {
        return (
            <LogisticsSecurityPortal
                onOpenMyRequests={() => setSecurityView(false)}
            />
        );
    }

    if (securityAccess) {
        return (
            <>
                <div className="bg-zinc-950 px-4 pt-4 text-white sm:px-6 lg:px-10">
                    <div className="mx-auto flex max-w-7xl justify-end">
                        <button
                            type="button"
                            onClick={() => setSecurityView(true)}
                            className="rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-2.5 text-sm font-semibold text-amber-200 transition hover:bg-amber-400/15"
                        >
                            Maak sekuriteitsversoeke oop
                        </button>
                    </div>
                </div>

                <LogisticsTeacherPortal user={user} />
            </>
        );
    }

    if (managementAccess && adminRequestMode) {
        return (
            <LogisticsTeacherPortal
                user={user}
                onBackToManagement={() => setAdminRequestMode(false)}
            />
        );
    }

    return managementAccess ? (
        <LogisticsManagementDashboard
            onCreateRequest={() => setAdminRequestMode(true)}
        />
    ) : (
        <LogisticsTeacherPortal user={user} />
    );
}