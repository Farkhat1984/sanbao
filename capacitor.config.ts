import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.sanbao.app',
  appName: 'Sanbao',
  webDir: 'out', 

  server: {
    url: 'https://www.sanbao.ai',
    cleartext: false
  },

  ios: {
    contentInset: 'automatic'
  }
};

export default config;
