import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.gmt.app',
  appName: 'MGT App',
  webDir: '.next/server/app',
  server: {
    androidScheme: 'https'
  }
};

export default config;
