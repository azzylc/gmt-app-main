import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.gmt.app',
  appName: 'MGT App',
  webDir: 'out',
  server: {
    androidScheme: 'https',
    iosScheme: 'capacitor', // ✅ iOS için ŞART
    allowNavigation: [
      'apis.google.com',
      '*.firebaseapp.com',
      '*.googleapis.com',
      'identitytoolkit.googleapis.com',
      'gys.mgtapp.com' // Web URL
    ]
  }
};

export default config;