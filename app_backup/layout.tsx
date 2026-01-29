import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GYS Studio - Gizem Yolcu",
  description: "Gelin Yonetim Sistemi",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="tr">
      <body>{children}</body>
    </html>
  );
}