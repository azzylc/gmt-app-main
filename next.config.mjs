import { withSentryConfig } from '@sentry/nextjs';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'export',           // ✅ Static export
  images: {
    unoptimized: true         // ✅ Static export için gerekli
  },
  trailingSlash: true,        // ✅ Capacitor için gerekli
  
  // ⚠️ API routes için environment variable
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'https://gys.mgtapp.com'
  }
};

export default withSentryConfig(nextConfig, {
  org: "gmt-app-main",
  project: "javascript-nextjs",
  silent: !process.env.CI,
  widenClientFileUpload: true,
  
  // ⚠️ tunnelRoute static export ile çalışmaz, kaldırıldı
  // tunnelRoute: "/monitoring",
  
  webpack: {
    automaticVercelMonitors: true,
    treeshake: {
      removeDebugLogging: true,
    },
  },
});
