import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tangled Org — Governance & Compliance",
  description: "Protocol-native organization governance and compliance layer for Tangled, the decentralized Git platform on AT Protocol.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body>{children}</body>
    </html>
  );
}
