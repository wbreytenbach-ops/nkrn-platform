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
    const [theme, setTheme] = useState<ThemePreference>("system");
    const label = language === "af" ? "Taal" : "Language";
    const themeLabel = language === "af" ? "Tema" : "Theme";

    useEffect(() => {
        const saved = localStorage.getItem("nkrn-theme");
        const preference: ThemePreference = saved === "light" || saved === "dark" || saved === "system" ? saved : "system";
        setTheme(preference);
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
        <div className="fixed right-4 top-4 z-[100] flex items-center gap-2 rounded-xl border border-white/10 bg-black/35 px-2.5 py-2 text-xs text-zinc-300 shadow-lg shadow-black/20 backdrop-blur-xl">
            <label htmlFor="nkrn-language" className="sr-only">{label}</label>
            <span aria-hidden="true" className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">{label}</span>
            <select
                id="nkrn-language"
                value={language}
                onChange={(event) => setLanguage(event.target.value as "en" | "af")}
                aria-label={label}
                data-nkrn-i18n-ignore
                className="rounded-lg border border-white/10 bg-zinc-900/80 px-2 py-1.5 text-xs font-semibold text-white outline-none transition focus:border-[#d7a31f]/60"
            >
                <option value="af">Afrikaans</option>
                <option value="en">English</option>
            </select>
            <span aria-hidden="true" className="mx-0.5 h-5 w-px bg-white/15" />
            <label htmlFor="nkrn-theme" className="sr-only">{themeLabel}</label>
            <select
                id="nkrn-theme"
                value={theme}
                onChange={(event) => changeTheme(event.target.value as ThemePreference)}
                aria-label={themeLabel}
                data-nkrn-i18n-ignore
                className="rounded-lg border border-white/10 bg-zinc-900/80 px-2 py-1.5 text-xs font-semibold text-white outline-none transition focus:border-[#d7a31f]/60"
            >
                <option value="system">{language === "af" ? "Stelsel" : "System"}</option>
                <option value="light">{language === "af" ? "Lig" : "Light"}</option>
                <option value="dark">{language === "af" ? "Donker" : "Dark"}</option>
            </select>
        </div>
    );
}
