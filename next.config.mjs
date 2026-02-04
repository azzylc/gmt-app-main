import { withSentryConfig } from '@sentry/nextjs';

const nextConfig = {
  reactStrictMode: true,
  ...(process.env.NEXT_BUILD_TARGET === 'ios' && {
    output: 'export',
    trailingSlash: true,
  }),
  images: { unoptimized: true },
  productionBrowserSourceMaps: false,
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'https://gys.mgtapp.com'
  }
};

export default withSentryConfig(nextConfig, {
  org: "mgt-app",
  project: "javascript-nextjs",
  silent: !process.env.CI,
  widenClientFileUpload: true,
  webpack: {
    automaticVercelMonitors: true,
    treeshake: { removeDebugLogging: true },
  },
});
