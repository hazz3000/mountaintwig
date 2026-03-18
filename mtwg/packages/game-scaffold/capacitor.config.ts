import { CapacitorConfig } from '@capacitor/cli'

// ── CHANGE THESE per game ─────────────────────────────────────────────────────
const GAME_SLUG  = 'game-01'         // must match games.slug in DB
const APP_NAME   = 'Game One'        // display name in App Store
const BUNDLE_SUFFIX = 'game01'       // no dots, no dashes
// ─────────────────────────────────────────────────────────────────────────────

const config: CapacitorConfig = {
  appId:   `games.mountaintwig.${BUNDLE_SUFFIX}`,
  appName: APP_NAME,
  webDir:  'dist',
  server:  {
    androidScheme: 'https',
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    // Universal Links / App Links for Branch.io deep links
    // Domain must match apple-app-site-association on your server
  },
}

export default config
