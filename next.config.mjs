import { withSentryConfig } from '@sentry/nextjs';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  
  // 🎯 iOS build için static export
  // Kullanım: NEXT_BUILD_TARGET=ios npm run build
  ...(process.env.NEXT_BUILD_TARGET === 'ios' && {
    output: 'export',
    trailingSlash: true,
  }),
  
  // Her iki durumda da gerekli
  images: {
    unoptimized: true
  },
  
  // API URL
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'https://gys.mgtapp.com'
  }
};

export default withSentryConfig(nextConfig, {
  org: "gmt-app-main",
  project: "javascript-nextjs",
  silent: !process.env.CI,
  widenClientFileUpload: true,
  
  webpack: {
    automaticVercelMonitors: true,
    treeshake: {
      removeDebugLogging: true,
    },
  },
});
