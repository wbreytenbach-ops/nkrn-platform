import type { Metadata, Viewport } from "next";
import LanguageShell from "./components/LanguageShell";
import PwaRegister from "./components/PwaRegister";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://portal.tygies.co.za"),

  title: {
    default: "Tygies One | Laerskool Tygerpoort",
    template: "%s | Tygies One",
  },

  description:
    "Tygies One is Laerskool Tygerpoort’s secure school operations portal for staff requests, logistics, event support and administration.",

  applicationName: "Tygies One",

  manifest: "/manifest.webmanifest",

  icons: {
    icon: [
      {
        url: "/icon-32x32.png",
        sizes: "32x32",
        type: "image/png",
      },
      {
        url: "/icon-192x192.png",
        sizes: "192x192",
        type: "image/png",
      },
    ],

    shortcut: "/icon-32x32.png",

    apple: [
      {
        url: "/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  },

  appleWebApp: {
    capable: true,
    title: "Tygies One",
    statusBarStyle: "black-translucent",
  },

  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: "#B91C2B",
  colorScheme: "light dark",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="af" suppressHydrationWarning>
      <body>
        <PwaRegister />
        <LanguageShell>{children}</LanguageShell>
      </body>
    </html>
  );
}
