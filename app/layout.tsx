import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/components/auth/AuthProvider";

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
    <html lang="en">
      <head>
        <link
          rel="preconnect"
          href="https://fonts.googleapis.com"
        />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin=""
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
