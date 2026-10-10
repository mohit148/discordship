import type { Metadata } from "next";
import "./globals.css";

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
