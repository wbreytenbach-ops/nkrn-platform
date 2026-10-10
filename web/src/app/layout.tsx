import type { Metadata, Viewport } from "next";
import LanguageShell from "./components/LanguageShell";
import PwaRegister from "./components/PwaRegister";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://portal.tygies.co.za"),

  title: {
    default: "Laerskool Tygerpoort",
    template: "%s | Laerskool Tygerpoort",
  },

  description:
    "Laerskool Tygerpoort's secure school operations platform for IT support, logistics and administration.",

  applicationName: "Laerskool Tygerpoort",

  manifest: "/manifest.webmanifest",

  icons: {
    icon: [
      {
        url: "/tygie-logo.png",
        type: "image/png",
      },
    ],

    shortcut: "/tygie-logo.png",

    apple: [
      {
        url: "/tygie-logo.png",
        type: "image/png",
      },
    ],
  },

  appleWebApp: {
    capable: true,
    title: "Tygerpoort",
    statusBarStyle: "black-translucent",
  },

  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: "#0b0b0d",
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
