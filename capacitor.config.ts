import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.choircollective.app',
  appName: 'Choir Collective',
  webDir: 'out',
  server: {
    url: 'https://choir-app-ecru.vercel.app',
    cleartext: false
  },
  plugins: {
    LocalNotifications: {
      smallIcon: 'ic_launcher',
      iconColor: '#0b4d24',
    },
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"]
    }
  }
};

export default config;
