"use client";
import "./globals.css";
import { AuthProvider, AuthGuard } from './lib/AuthSystem';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="tr">
      <head>
        <title>GYS Studio - Gizem Yolcu</title>
        <meta name="description" content="Gelin Yönetim Sistemi" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
      </head>
      <body>
        <AuthProvider>
          <AuthGuard>
            {children}
          </AuthGuard>
        </AuthProvider>
      </body>
    </html>
  );
}
