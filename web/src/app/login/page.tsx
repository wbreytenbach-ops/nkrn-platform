"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import "../nkrn-control.css";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

type LoggedInUser = {
    userID: number;
    firstName: string;
    lastName: string;
    email: string;
    roleID: number;
};

interface GoogleIdentityClient {
    accounts: {
        id: {
            initialize: (config: {
                client_id: string;
                callback: (response: { credential: string }) => void;
                hd?: string;
                auto_select?: boolean;
            }) => void;
            renderButton: (
                parent: HTMLElement,
                options: {
                    theme: string;
                    size: string;
                    text: string;
                    shape: string;
                    width: number;
                }
            ) => void;
            disableAutoSelect: () => void;
        };
    };
}

declare global {
    interface Window {
        google?: GoogleIdentityClient;
    }
}

export default function LoginPage() {
    const router = useRouter();
    const buttonRef = useRef<HTMLDivElement>(null);
    const [loading, setLoading] = useState(false);
    const [configured, setConfigured] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        let cancelled = false;
        let script: HTMLScriptElement | null = null;

        async function finishSignIn(credential: string) {
            if (cancelled) return;
            setLoading(true);
            setError("");
            try {
                const response = await fetch(
                    `${API_URL || window.location.origin}/api/Auth/google`,
                    {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ credential }),
                        cache: "no-store"
                    }
                );
                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({})) as {
                        message?: string;
                    };
                    throw new Error(errorData.message || "Google sign-in could not be completed.");
                }

                const data = await response.json() as {
                    token: string;
                    user: LoggedInUser;
                };
                if (!data.token || !data.user || !cancelled) {
                    if (!data.token || !data.user) throw new Error("Invalid sign-in response.");
                }
                if (cancelled) return;

                localStorage.setItem("token", data.token);
                localStorage.setItem("user", JSON.stringify(data.user));

                const requestedPath =
                    new URLSearchParams(window.location.search).get("next") ||
                    sessionStorage.getItem("tygies-return-path");
                const safePath = requestedPath?.startsWith("/") && !requestedPath.startsWith("//")
                    ? requestedPath
                    : "/";
                sessionStorage.removeItem("tygies-return-path");
                router.replace(safePath);
            } catch (loginError) {
                if (!cancelled) {
                    setError(loginError instanceof Error
                        ? loginError.message
                        : "Google sign-in failed.");
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        }

        async function configureGoogle() {
            try {
                const response = await fetch(
                    `${API_URL || window.location.origin}/api/Auth/google/config`,
                    { cache: "no-store" }
                );
                if (!response.ok) throw new Error("Google SSO is not yet configured by IT.");
                const data = await response.json() as { clientId?: string };
                if (!data.clientId) throw new Error("Google OAuth client ID is missing.");

                const start = () => {
                    if (cancelled || !buttonRef.current || !window.google) return;
                    window.google.accounts.id.initialize({
                        client_id: data.clientId!,
                        hd: "tygies.co.za",
                        auto_select: false,
                        callback: (credential) => { void finishSignIn(credential.credential); }
                    });
                    buttonRef.current.replaceChildren();
                    window.google.accounts.id.renderButton(buttonRef.current, {
                        theme: "outline",
                        size: "large",
                        text: "signin_with",
                        shape: "rectangular",
                        width: 300
                    });
                    setConfigured(true);
                };

                if (window.google) {
                    start();
                    return;
                }

                script = document.querySelector<HTMLScriptElement>(
                    'script[data-tygies-google="true"]'
                );
                if (!script) {
                    script = document.createElement("script");
                    script.src = "https://accounts.google.com/gsi/client";
                    script.async = true;
                    script.dataset.tygiesGoogle = "true";
                    document.head.appendChild(script);
                }
                script.addEventListener("load", start);
                script.addEventListener("error", () => {
                    if (!cancelled) setError("Could not load Google Sign-In. Check your connection.");
                }, { once: true });
                if (window.google) start();
            } catch (setupError) {
                if (!cancelled) {
                    setError(setupError instanceof Error
                        ? setupError.message
                        : "Google SSO is unavailable.");
                }
            }
        }

        void configureGoogle();
        return () => {
            cancelled = true;
        };
    }, [router]);

    return (
        <main className="tygies-login-page relative min-h-screen overflow-hidden bg-zinc-950 text-white">
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
                <div className="absolute -left-44 -top-44 h-136 w-136 rounded-full bg-white/4 blur-3xl" />
                <div className="absolute -right-48 top-1/4 h-152 w-152 rounded-full bg-[#d7a31f]/4 blur-3xl" />
                <div className="absolute -bottom-72 left-1/3 h-136 w-136 rounded-full bg-white/2.5 blur-3xl" />
            </div>

            <div className="relative z-10 flex min-h-screen flex-col">
                <header className="mx-auto flex w-full max-w-7xl items-center gap-4 px-5 py-6 sm:px-8 lg:px-10">
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
                        <p className="text-xs font-semibold uppercase tracking-widest text-[#d7a31f]">
                            Laerskool Tygerpoort
                        </p>
                        <p className="mt-1 text-sm text-zinc-300">
                            Tygies One · School Operations Portal
                        </p>
                    </div>
                </header>

                <div className="mx-auto flex w-full max-w-7xl flex-1 items-center justify-center px-5 pb-12">
                    <section className="w-full max-w-md rounded-[28px] border border-white/10 bg-white/5 p-7 shadow-2xl backdrop-blur-2xl sm:p-9">
                        <p className="text-xs font-semibold uppercase tracking-widest text-[#d7a31f]">
                            Authorised access / Gemagtigde toegang
                        </p>
                        <h1 className="mt-3 text-3xl font-bold">Sign in / Meld aan</h1>
                        <p className="mt-4 text-sm leading-6 text-zinc-300">
                            Use your Tygerpoort Google Workspace account.
                            Gebruik jou Tygerpoort Google Workspace-rekening.
                        </p>

                        {error && (
                            <p role="alert" className="mt-5 rounded-xl border border-red-400/25 bg-red-500/10 p-4 text-sm text-red-200">
                                {error}
                            </p>
                        )}

                        <div className="mt-7 flex min-h-12 flex-col items-center justify-center rounded-xl bg-white p-3">
                            <div ref={buttonRef} />
                            {!configured && !error && (
                                <p className="text-sm text-zinc-700">Loading Google Sign-In…</p>
                            )}
                        </div>

                        {loading && (
                            <p className="mt-4 text-center text-sm text-zinc-300">
                                Verifying your Google account / Verifieer jou Google-rekening…
                            </p>
                        )}

                        <p className="mt-6 text-xs leading-5 text-zinc-400">
                            Only Google-verified @tygies.co.za Workspace identities
                            with active Tygies One accounts can sign in.
                            All access permissions are enforced by the server.
                        </p>
                    </section>
                </div>
            </div>
        </main>
    );
}
