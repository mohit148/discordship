import type { Metadata } from "next";
import "./globals.css";

// Every page here depends on the signed-in visitor (cookies) and live database data, so none of them can be
// pre-rendered at build time. Saying so up front also stops the "Dynamic server usage" noise in build logs.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "ship.",
  description: "A little board for ships, cards, and the people behind them.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-sans text-ink antialiased">{children}</body>
    </html>
  );
}
