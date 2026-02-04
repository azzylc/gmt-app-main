"use client";
import "./globals.css";
import { AuthProvider } from './AuthProvider';
import { DebugOverlay } from './components/DebugOverlay';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="tr">
      <head>
        <title>GYS Studio - Gizem Yolcu</title>
        <meta name="description" content="Gelin Yonetim Sistemi" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
      </head>
      <body>
        <AuthProvider>
          {children}
        </AuthProvider>
        <DebugOverlay />
      </body>
    </html>
  );
}