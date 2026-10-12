"use client";

import type { ReactNode } from "react";
import { LanguageProvider } from "../language";
import LanguageSwitcher from "./LanguageSwitcher";
import WorkspaceShell from "./WorkspaceShell";
import "./workspace-shell.css";

export default function LanguageShell({ children }: { children: ReactNode }) {
    return (
        <LanguageProvider>
            <WorkspaceShell>
                <LanguageSwitcher />
                {children}
            </WorkspaceShell>
        </LanguageProvider>
    );
}
