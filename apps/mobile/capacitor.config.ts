import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.sanbao.sanbaoai',
  appName: 'Sanbao AI',
  webDir: 'dist',
  server: {
    url: 'https://sanbao.ai',
    androidScheme: 'https',
    cleartext: false,
    allowNavigation: ['sanbao.ai', '*.sanbao.ai'],
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      launchShowDuration: 2000,
      backgroundColor: '#1C2B3A',
    },
    Keyboard: {
      resize: 'body',
      resizeOnFullScreen: true,
    },
    StatusBar: {
      style: 'dark',
      backgroundColor: '#1C2B3A',
    },
    GoogleAuth: {
      scopes: ['profile', 'email'],
      serverClientId: '785998485085-ufi4mt9193bs4r5v6jtcc6f7k367po7s.apps.googleusercontent.com',
      forceCodeForRefreshToken: true,
    },
  },
}

export default config
