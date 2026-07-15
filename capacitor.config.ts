import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.tokenpro.app',
  appName: 'TokenPro',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
