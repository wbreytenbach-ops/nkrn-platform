import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tygerpoort IT Desk",
  description: "Laerskool Tygerpoort IT Support Portal",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {

  return (
    <html lang="en">

      <body>

        {children}

      </body>

    </html>
  );
}