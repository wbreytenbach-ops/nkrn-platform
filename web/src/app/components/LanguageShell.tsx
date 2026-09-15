"use client";

import type { ReactNode } from "react";
import { LanguageProvider } from "../language";
import LanguageSwitcher from "./LanguageSwitcher";

export default function LanguageShell({ children }: { children: ReactNode }) {
    return (
        <LanguageProvider>
            <LanguageSwitcher />
            {children}
        </LanguageProvider>
    );
}
