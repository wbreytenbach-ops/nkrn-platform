"use client";

import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";
import "../nkrn-control.css";

const API_URL =
    process.env.NEXT_PUBLIC_API_URL;

interface LoggedInUser {
    userID: number;
    firstName: string;
    lastName: string;
    email: string;
    roleID: number;
    isActive: boolean;
}

export default function LoginPage() {
    const router = useRouter();

    const [email, setEmail] =
        useState("");

    const [loading, setLoading] =
        useState(false);

    const [error, setError] =
        useState("");

    async function handleLogin(
        event: React.FormEvent<HTMLFormElement>
    ) {
        event.preventDefault();

        setError("");

        const cleanEmail =
            email.trim().toLowerCase();

        if (!cleanEmail) {
            setError(
                "Please enter your Tygerpoort email address."
            );

            return;
        }

        if (
            !cleanEmail.endsWith(
                "@tygies.co.za"
            )
        ) {
            setError(
                "Please use your @tygies.co.za email address."
            );

            return;
        }

        try {
            setLoading(true);

            const response =
                await fetch(
                    `${API_URL}/api/Auth/login`,
                    {
                        method: "POST",
                        headers: {
                            "Content-Type":
                                "application/json",
                        },
                        body:
                            JSON.stringify({
                                email:
                                    cleanEmail,
                            }),
                    }
                );

            if (!response.ok) {
                const responseText =
                    await response.text();

                console.error(
                    "Login response:",
                    response.status,
                    responseText
                );

                throw new Error(
                    "Unable to sign in."
                );
            }

            const data =
                await response.json();

            if (data.token) {
                localStorage.setItem(
                    "token",
                    data.token
                );
            }

            const loggedInUser: LoggedInUser =
                data.user ?? data;

            localStorage.setItem(
                "user",
                JSON.stringify(
                    loggedInUser
                )
            );

            router.push("/");
        } catch (error) {
            console.error(
                "Login error:",
                error
            );

            setError(
                error instanceof Error
                    ? error.message
                    : "Unable to sign in."
            );
        } finally {
            setLoading(false);
        }
    }

    return (
        <main className="nkrn-control relative min-h-screen overflow-hidden bg-zinc-950 text-white">
            {/* BACKGROUND */}

            <div className="pointer-events-none absolute inset-0 overflow-hidden">
                <div className="absolute -left-44 -top-44 h-136 w-136 rounded-full bg-white/4 blur-3xl" />

                <div className="absolute -right-48 top-1/4 h-152 w-152 rounded-full bg-[#d7a31f]/4 blur-3xl" />

                <div className="absolute -bottom-72 left-1/3 h-136 w-136 rounded-full bg-white/2.5 blur-3xl" />

                <div className="absolute inset-0 flex items-center justify-center opacity-[0.025]">
                    <Image
                        src="/tygie-logo.png"
                        alt=""
                        width={760}
                        height={760}
                        priority
                    />
                </div>
            </div>

            {/* CONTENT */}

            <div className="relative z-10 flex min-h-screen flex-col">
                <header className="mx-auto flex w-full max-w-7xl items-center justify-between px-5 py-6 sm:px-8 lg:px-10">
                    <div className="flex items-center gap-4">
                        <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl">
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
                            <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-[#d7a31f]">
                                Laerskool Tygerpoort
                            </p>

                            <p className="mt-1 text-sm font-medium text-zinc-300">
                                School Operations Platform
                            </p>
                        </div>
                    </div>

                    <div className="hidden items-center gap-2 text-xs text-zinc-600 sm:flex">
                        <span className="h-2 w-2 rounded-full bg-green-400/80" />
                        Secure access
                    </div>
                </header>

                <div className="mx-auto grid w-full max-w-7xl flex-1 items-center gap-10 px-5 pb-10 sm:px-8 lg:grid-cols-[1.05fr_0.95fr] lg:px-10">
                    {/* PLATFORM INTRODUCTION */}

                    <section className="hidden max-w-2xl lg:block">
                        <p className="mb-4 text-xs font-semibold uppercase tracking-[0.24em] text-[#d7a31f]">
                            One secure workspace
                        </p>

                        <h1 className="max-w-3xl text-5xl font-extrabold leading-[0.98] tracking-[-0.035em] text-white xl:text-6xl">
                            School operations,
                            <br />
                            connected.
                        </h1>

                        <p className="mt-6 max-w-xl text-lg leading-8 text-zinc-400">
                            Access your authorised school
                            services from one central
                            workspace, including technical
                            support and future operational
                            modules.
                        </p>

                        <div className="mt-9 grid max-w-xl grid-cols-2 gap-3">
                            <div className="rounded-2xl border border-white/8 bg-white/3.5 p-4 backdrop-blur-xl">
                                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-600">
                                    Available now
                                </p>

                                <p className="mt-2 text-sm font-semibold text-zinc-200">
                                    IT Desk
                                </p>
                            </div>

                            <div className="rounded-2xl border border-white/8 bg-white/3.5 p-4 backdrop-blur-xl">
                                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-600">
                                    Access
                                </p>

                                <p className="mt-2 text-sm font-semibold text-zinc-200">
                                    Role-based workspace
                                </p>
                            </div>
                        </div>
                    </section>

                    {/* LOGIN PANEL */}

                    <section className="mx-auto w-full max-w-md lg:ml-auto">
                        <div className="nkrn-panel overflow-hidden rounded-[30px] border border-white/10 bg-white/5.5 shadow-2xl shadow-black/30 backdrop-blur-2xl">
                            <div className="border-b border-white/8 px-6 py-6 sm:px-8">
                                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#d7a31f]">
                                    Authorised Access
                                </p>

                                <h2 className="mt-2 text-3xl font-bold tracking-tight text-white">
                                    Sign in
                                </h2>

                                <p className="mt-2 text-sm leading-6 text-zinc-500">
                                    Use your Tygerpoort
                                    account to enter the
                                    school operations
                                    workspace.
                                </p>
                            </div>

                            <div className="px-6 py-6 sm:px-8 sm:py-8">
                                {error && (
                                    <div className="mb-6 rounded-2xl border border-red-400/15 bg-red-500/8 p-4 text-sm text-red-300 backdrop-blur-xl">
                                        {error}
                                    </div>
                                )}

                                <form
                                    onSubmit={
                                        handleLogin
                                    }
                                    className="space-y-5"
                                >
                                    <div>
                                        <label
                                            htmlFor="email"
                                            className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500"
                                        >
                                            Tygerpoort email
                                            address
                                        </label>

                                        <input
                                            id="email"
                                            type="email"
                                            value={email}
                                            onChange={(
                                                event
                                            ) =>
                                                setEmail(
                                                    event
                                                        .target
                                                        .value
                                                )
                                            }
                                            placeholder="name@tygies.co.za"
                                            autoComplete="email"
                                            autoFocus
                                            disabled={
                                                loading
                                            }
                                            className="nkrn-input w-full rounded-xl border border-white/10 bg-black/25 p-3.5 text-sm text-white outline-none transition placeholder:text-zinc-700 focus:border-[#d7a31f]/40 focus:bg-black/35 disabled:cursor-not-allowed disabled:opacity-50"
                                        />
                                    </div>

                                    <button
                                        type="submit"
                                        disabled={
                                            loading
                                        }
                                        className="group flex w-full items-center justify-between rounded-xl border border-[#d7a31f]/35 bg-[#d7a31f] px-4 py-3.5 text-sm font-bold text-black transition hover:bg-[#e7b42b] disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        <span>
                                            {loading
                                                ? "Signing in..."
                                                : "Continue"}
                                        </span>

                                        <span
                                            className="text-lg transition-transform group-hover:translate-x-1"
                                            aria-hidden="true"
                                        >
                                            →
                                        </span>
                                    </button>
                                </form>

                                <div className="mt-6 border-t border-white/7 pt-5">
                                    <div className="flex items-start gap-3">
                                        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-white/8 bg-white/3 text-zinc-500">
                                            <svg
                                                viewBox="0 0 24 24"
                                                className="h-4 w-4 fill-none stroke-current stroke-[1.8]"
                                                aria-hidden="true"
                                            >
                                                <rect
                                                    x="5"
                                                    y="10"
                                                    width="14"
                                                    height="10"
                                                    rx="2"
                                                />
                                                <path d="M8 10V7a4 4 0 0 1 8 0v3" />
                                            </svg>
                                        </div>

                                        <p className="text-xs leading-5 text-zinc-600">
                                            Access is restricted
                                            to authorised
                                            Tygerpoort users.
                                            Your available
                                            modules are
                                            determined by your
                                            account permissions.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>
                </div>

                <footer className="mx-auto flex w-full max-w-7xl flex-col gap-2 border-t border-white/7 px-5 py-5 text-xs text-zinc-600 sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-10">
                    <p>
                        Laerskool Tygerpoort · Secure
                        school operations workspace
                    </p>

                    <p className="font-semibold tracking-wide text-zinc-500">
                        NKRN™ ©
                    </p>
                </footer>
            </div>
        </main>
    );
}
