import type { Metadata, Viewport } from "next";
import "./globals.css";
import { TopBar } from "@/components/TopBar";

export const metadata: Metadata = {
  title: "Court Steno Tools",
  description: "Scriptix-to-TSN formatter and English-to-Gregg shorthand writer. Everything runs in your browser.",
  applicationName: "Court Steno Tools",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = { themeColor: "#1A2233", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <TopBar />
        {children}
      </body>
    </html>
  );
}
