import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GMT App - Gizem Yolcu Studio",
  description: "Gelin makyaj ve türban takibi sistemi",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
