"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import LogisticsManagementDashboard from "./LogisticsManagementDashboard";
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

                // NKRN admins always retain management access.
                if (loggedInUser.roleID === 3) {
                    setManagementAccess(true);
                    return;
                }

                // This endpoint already respects Logistics ModulePermissions.
                // 200 = Logistics management/view access.
                // 403 = normal staff member -> teacher portal.
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
                    `Unable to determine Logistics access (${response.status}).`
                );
            } catch (accessError) {
                console.error("Unable to determine Logistics access:", accessError);

                if (!cancelled) {
                    setError(
                        accessError instanceof Error
                            ? accessError.message
                            : "Unable to open Logistics."
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
                        Logistics
                    </p>
                    <p className="mt-2 text-sm text-zinc-400">
                        Opening your workspace…
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
                        Back to NKRN
                    </button>
                </div>
            </main>
        );
    }

    if (!user) {
        return null;
    }

    return managementAccess ? (
        <LogisticsManagementDashboard />
    ) : (
        <LogisticsTeacherPortal user={user} />
    );
}
