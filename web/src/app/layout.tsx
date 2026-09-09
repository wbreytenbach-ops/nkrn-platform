import type { Metadata, Viewport } from "next";
import PwaRegister from "./components/PwaRegister";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://portal.tygies.co.za"),

  title: {
    default: "NKRN | Laerskool Tygerpoort",
    template: "%s | NKRN",
  },

  description:
    "Laerskool Tygerpoort's secure school operations platform for IT support, logistics and administration.",

  applicationName: "NKRN School Operations",

  manifest: "/manifest.webmanifest",

  icons: {
    icon: [
      {
        url: "/favicon.ico",
      },
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
      {
        url: "/icon-512x512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],

    shortcut: "/favicon.ico",

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
    title: "NKRN",
    statusBarStyle: "black-translucent",
  },

  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: "#0b0b0d",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <PwaRegister />
        {children}
      </body>
    </html>
  );
}