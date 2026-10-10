"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { type ReactNode, useEffect, useState } from "react";
import { useLanguage } from "../language";

type SessionUser = {
    firstName?: string;
    lastName?: string;
    roleID?: number;
};

const navigation = [
    { href: "/", labelAf: "Tuis", labelEn: "Home", icon: "home", roles: [1, 2, 3] },
    { href: "/requests", labelAf: "IT-versoeke", labelEn: "IT requests", icon: "monitor", roles: [1, 2, 3] },
    { href: "/Logistics", labelAf: "Logistiek", labelEn: "Logistics", icon: "truck", roles: [1, 2, 3] },
    { href: "/Funksieversorging", labelAf: "Funksieversorging", labelEn: "Function setup", icon: "calendar", roles: [1, 2, 3] },
    { href: "/Tech", labelAf: "Tegnikusportaal", labelEn: "Technician desk", icon: "wrench", roles: [2, 3] },
    { href: "/Admin", labelAf: "Administrasie", labelEn: "Administration", icon: "settings", roles: [3] },
];

function NavigationIcon({ name }: { name: string }) {
    const common = "h-5 w-5 shrink-0 fill-none stroke-current stroke-[1.7]";
    const paths: Record<string, ReactNode> = {
        home: <><path d="m3 10 9-7 9 7" /><path d="M5 9v11h14V9M9 20v-6h6v6" /></>,
        monitor: <><rect x="3" y="4" width="18" height="13" rx="2" /><path d="M8 21h8M12 17v4M7 8h10M7 11h6" /></>,
        truck: <><path d="M3 6h11v11H3zM14 10h4l3 3v4h-7z" /><circle cx="7" cy="19" r="1.5" /><circle cx="18" cy="19" r="1.5" /></>,
        calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M7 3v4M17 3v4M3 10h18M7 14h3M14 14h3M7 17h3" /></>,
        wrench: <><path d="M14 6a5 5 0 0 0-6 6L3 17l4 4 5-5a5 5 0 0 0 6-6l-3 3-4-4z" /></>,
        settings: <><circle cx="12" cy="12" r="3" /><path d="m19.4 15 .1.1 1.4 1.1-1.4 2.4-1.7-.7a8 8 0 0 1-1.8 1l-.3 1.8h-2.8l-.3-1.8a8 8 0 0 1-1.8-1l-1.7.7-1.4-2.4L7.1 15a8 8 0 0 1 0-2l-1.4-1.1 1.4-2.4 1.7.7a8 8 0 0 1 1.8-1l.3-1.8h2.8l.3 1.8a8 8 0 0 1 1.8 1l1.7-.7 1.4 2.4-1.4 1.1a8 8 0 0 1-.1 2z" /></>,
    };
    return <svg viewBox="0 0 24 24" aria-hidden="true" className={common}>{paths[name] ?? paths.home}</svg>;
}

export default function WorkspaceShell({ children }: { children: ReactNode }) {
    const pathname = usePathname();
    const router = useRouter();
    const { language } = useLanguage();
    const [sessionUser, setSessionUser] = useState<SessionUser | null>(null);
    const [collapsed, setCollapsed] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);
    const [ready, setReady] = useState(false);

    useEffect(() => {
        const token = localStorage.getItem("token");
        const rawUser = localStorage.getItem("user");
        if (token && rawUser) {
            try { setSessionUser(JSON.parse(rawUser) as SessionUser); }
            catch { setSessionUser(null); }
        }
        setCollapsed(localStorage.getItem("tygies-sidebar-collapsed") === "true");
        setReady(true);
    }, [pathname]);

    useEffect(() => {
        if (pathname === "/login" || !ready || !sessionUser) return;
        document.documentElement.classList.add("tygies-workspace-active");
        return () => document.documentElement.classList.remove("tygies-workspace-active");
    }, [pathname, ready, sessionUser]);

    if (pathname === "/login" || !ready || !sessionUser) {
        return <>{children}</>;
    }

    const roleID = Number(sessionUser.roleID ?? 1);
    const visibleNavigation = navigation.filter((item) => item.roles.includes(roleID));
    const isActive = (href: string) => href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");
    const af = language === "af";

    function toggleCollapsed() {
        setCollapsed((current) => {
            const next = !current;
            localStorage.setItem("tygies-sidebar-collapsed", String(next));
            return next;
        });
    }

    function logout() {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        router.replace("/login");
    }

    return (
        <div className={`workspace-shell ${collapsed ? "is-collapsed" : ""} ${mobileOpen ? "mobile-open" : ""}`}>
            {mobileOpen && <button type="button" className="workspace-backdrop" aria-label={af ? "Sluit navigasie" : "Close navigation"} onClick={() => setMobileOpen(false)} />}
            <aside className="workspace-sidebar" aria-label={af ? "Hoofnavigasie" : "Main navigation"}>
                <div className="workspace-brand">
                    <Link href="/" className="workspace-brand-link" aria-label="Tygies One home" onClick={() => setMobileOpen(false)}>
                        <Image src="/icon-192x192.png" alt="Laerskool Tygerpoort school crest" width={42} height={42} priority className="workspace-crest" />
                        <span className="workspace-brand-copy"><strong>Tygies One</strong><small>Laerskool Tygerpoort</small></span>
                    </Link>
                    <button type="button" className="workspace-collapse" onClick={toggleCollapsed} aria-label={collapsed ? (af ? "Brei navigasie uit" : "Expand navigation") : (af ? "Vou navigasie in" : "Collapse navigation")} title={collapsed ? "Expand navigation" : "Collapse navigation"}>‹</button>
                </div>
                <div className="workspace-nav-label">{af ? "WERKRUIMTE" : "WORKSPACE"}</div>
                <nav className="workspace-nav">
                    {visibleNavigation.map((item) => (
                        <Link key={item.href} href={item.href} onClick={() => setMobileOpen(false)} aria-current={isActive(item.href) ? "page" : undefined} className={`workspace-nav-link ${isActive(item.href) ? "is-active" : ""}`} title={collapsed ? (af ? item.labelAf : item.labelEn) : undefined}>
                            <NavigationIcon name={item.icon} />
                            <span>{af ? item.labelAf : item.labelEn}</span>
                        </Link>
                    ))}
                </nav>
                <div className="workspace-sidebar-footer">
                    <span className="workspace-avatar">{(sessionUser.firstName?.[0] ?? "T").toUpperCase()}{(sessionUser.lastName?.[0] ?? "O").toUpperCase()}</span>
                    <span className="workspace-user-copy"><strong>{sessionUser.firstName} {sessionUser.lastName}</strong><small>{af ? "Aangemelde gebruiker" : "Signed-in user"}</small></span>
                    <button type="button" onClick={logout} className="workspace-logout" title={af ? "Meld af" : "Sign out"} aria-label={af ? "Meld af" : "Sign out"}>↪</button>
                </div>
            </aside>
            <div className="workspace-main">
                <header className="workspace-topbar">
                    <button type="button" className="workspace-mobile-menu" onClick={() => setMobileOpen(true)} aria-label={af ? "Maak navigasie oop" : "Open navigation"}>☰</button>
                    <div className="workspace-page-context"><span>{af ? "Laerskool Tygerpoort" : "Laerskool Tygerpoort"}</span><strong>{visibleNavigation.find((item) => isActive(item.href))?.[af ? "labelAf" : "labelEn"] ?? "Tygies One"}</strong></div>
                    <div className="workspace-topbar-right"><span className="workspace-secure-dot" /> <span>{af ? "Veilige werkruimte" : "Secure workspace"}</span></div>
                </header>
                <div className="workspace-content">{children}</div>
            </div>
        </div>
    );
}
