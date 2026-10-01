import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ship.",
  description: "A little ship board for our Discord server.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-sans text-ink antialiased">{children}</body>
    </html>
  );
}
