import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "waflow — WhatsApp Cloud API flow engine",
  description:
    "A config-driven WhatsApp Cloud API flow engine: verify webhooks, drive a state machine, send interactive messages & Flows, capture leads.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
