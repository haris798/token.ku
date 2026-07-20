import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.tokenku.app',
  appName: 'Token.ku',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
