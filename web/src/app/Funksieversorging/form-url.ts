// Only a verified, direct respondent link may reach ordinary users. Never expose edit URLs.
export function respondentFormUrl(configured: string | undefined): string | null {
    if (!configured) return null;
    try {
        const url = new URL(configured);
        if (url.protocol !== "https:" || url.hostname !== "docs.google.com" || url.port || url.username || url.password) return null;
        if (!/^\/forms\/d\/(?:e\/)?[a-zA-Z0-9_-]+\/viewform\/?$/.test(url.pathname)) return null;
        url.search = ""; url.hash = "";
        return url.toString();
    } catch { return null; }
}
