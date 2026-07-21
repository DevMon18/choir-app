import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.choircollective.app',
  appName: 'Choir Collective',
  webDir: 'out',
  server: {
    url: 'https://choir-app-ecru.vercel.app',
    cleartext: false
  }
};

export default config;
