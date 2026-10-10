"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "../language";

type ThemePreference = "system" | "light" | "dark";

function applyTheme(theme: ThemePreference) {
    const resolved = theme === "system"
        ? (window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark")
        : theme;
    document.documentElement.dataset.theme = resolved;
    document.documentElement.style.colorScheme = resolved;
}

export default function LanguageSwitcher() {
    const { language, setLanguage } = useLanguage();
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [theme, setTheme] = useState<ThemePreference>("light");
    const settingsLabel = language === "af" ? "Instellings" : "Settings";
    const languageLabel = language === "af" ? "Taal" : "Language";
    const themeLabel = language === "af" ? "Tema" : "Theme";

    useEffect(() => {
        const saved = localStorage.getItem("nkrn-theme");
        const preference: ThemePreference = saved === "light" || saved === "dark" || saved === "system" ? saved : "light";
        applyTheme(preference);
        const media = window.matchMedia("(prefers-color-scheme: light)");
        const updateSystemTheme = () => {
            if ((localStorage.getItem("nkrn-theme") ?? "system") === "system") applyTheme("system");
        };
        media.addEventListener("change", updateSystemTheme);
        return () => media.removeEventListener("change", updateSystemTheme);
    }, []);

    function changeTheme(value: ThemePreference) {
        setTheme(value);
        localStorage.setItem("nkrn-theme", value);
        applyTheme(value);
    }

    return (
        <div className="fixed right-3 top-3 z-[100] sm:right-5 sm:top-5">
            <button
                type="button"
                onClick={() => {
                    const saved = localStorage.getItem("nkrn-theme");
                    setTheme(saved === "light" || saved === "dark" || saved === "system" ? saved : "light");
                    setSettingsOpen((open) => !open);
                }}
                aria-expanded={settingsOpen}
                aria-controls="nkrn-user-settings"
                className="flex items-center gap-2 rounded-xl border border-white/10 bg-zinc-950/85 px-3 py-2 text-xs font-semibold text-zinc-200 shadow-lg shadow-black/20 backdrop-blur-xl transition hover:border-[#b91c2b]/35 hover:text-white"
            >
                <span aria-hidden="true">⚙</span>
                {settingsLabel}
            </button>

            {settingsOpen && (
                <section
                    id="nkrn-user-settings"
                    aria-label={settingsLabel}
                    className="mt-2 w-64 rounded-2xl border border-white/10 bg-zinc-950/95 p-4 text-sm text-zinc-200 shadow-2xl shadow-black/30 backdrop-blur-xl"
                >
                    <div className="mb-4 flex items-center justify-between gap-3">
                        <h2 className="font-semibold">{settingsLabel}</h2>
                        <button
                            type="button"
                            onClick={() => setSettingsOpen(false)}
                            aria-label={language === "af" ? "Sluit instellings" : "Close settings"}
                            className="rounded-lg px-2 py-1 text-zinc-400 transition hover:bg-white/8 hover:text-white"
                        >
                            ×
                        </button>
                    </div>

                    <label htmlFor="nkrn-language" className="mb-2 block text-xs font-medium text-zinc-400">{languageLabel}</label>
                    <select
                        id="nkrn-language"
                        value={language}
                        onChange={(event) => setLanguage(event.target.value as "en" | "af")}
                        aria-label={languageLabel}
                        data-nkrn-i18n-ignore
                        className="mb-4 w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white outline-none transition focus:border-[#b91c2b]/60"
                    >
                        <option value="af">Afrikaans</option>
                        <option value="en">English</option>
                    </select>

                    <label htmlFor="nkrn-theme" className="mb-2 block text-xs font-medium text-zinc-400">{themeLabel}</label>
                    <select
                        id="nkrn-theme"
                        value={theme}
                        onChange={(event) => changeTheme(event.target.value as ThemePreference)}
                        aria-label={themeLabel}
                        data-nkrn-i18n-ignore
                        className="w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white outline-none transition focus:border-[#b91c2b]/60"
                    >
                        <option value="system">{language === "af" ? "Stelsel" : "System"}</option>
                        <option value="light">{language === "af" ? "Lig" : "Light"}</option>
                        <option value="dark">{language === "af" ? "Donker" : "Dark"}</option>
                    </select>
                </section>
            )}
        </div>
    );
}
