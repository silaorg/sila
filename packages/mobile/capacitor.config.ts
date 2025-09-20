import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.silain.mobile',
  appName: 'Sila',
  webDir: 'build',
  server: {
    androidScheme: 'https'
  }
};

export default config;
