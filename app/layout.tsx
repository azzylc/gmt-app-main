"use client";
import { useEffect, useState } from "react";
import "./globals.css";

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
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}
