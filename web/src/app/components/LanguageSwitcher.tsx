"use client";

import { useLanguage } from "../language";

export default function LanguageSwitcher() {
    const { language, setLanguage } = useLanguage();

    const label = language === "af" ? "Taal" : "Language";

    return (
        <div className="fixed right-4 top-4 z-[100] flex items-center gap-2 rounded-xl border border-white/10 bg-black/35 px-2.5 py-2 text-xs text-zinc-300 shadow-lg shadow-black/20 backdrop-blur-xl">
            <label htmlFor="nkrn-language" className="sr-only">
                {label}
            </label>
            <span aria-hidden="true" className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
                {label}
            </span>
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
        </div>
    );
}
