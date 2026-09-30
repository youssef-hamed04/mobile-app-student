import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * Environment-aware Expo config.
 *
 * APP_VARIANT is provided by the EAS build profile (see eas.json) or by the
 * shell when running locally:  APP_VARIANT=staging npx expo start
 */
type Variant = 'development' | 'staging' | 'production';

const VARIANT = (process.env.APP_VARIANT as Variant) ?? 'development';

/**
 * EAS project id. It is public (it is embedded in every build and in the
 * OTA update URL), so once `eas init` has printed it, it is safe to paste it
 * here as the fallback. It is never replaced with a fake value: an all-zero
 * UUID used to be the fallback, which made `eas build` target a project that
 * does not exist and made push-token requests fail silently.
 */
const EAS_PROJECT_ID = process.env.EAS_PROJECT_ID || 'f5f88e33-01f3-4049-ae16-6c3cd5221f57';

/**
 * Store builds must never ship with a development or placeholder backend.
 * This runs when EAS (or `expo prebuild`/`expo export`) evaluates the config,
 * so a misconfigured production build fails at build time instead of
 * crashing on the student's phone at startup.
 *
 * Enforced for production (EXPO_PUBLIC_ENV=production) on the EAS build
 * worker (EAS_BUILD=true, where every EAS environment variable is present),
 * and locally whenever an API URL has been provided. Reading the config for
 * tooling such as `eas credentials` or `eas submit` does not need the values
 * and is not blocked.
 */
function assertProductionEnv() {
  if (process.env.EXPO_PUBLIC_ENV !== 'production') return;
  if (process.env.EAS_BUILD !== 'true' && process.env.EXPO_PUBLIC_API_URL === undefined) return;

  const problems: string[] = [];
  const apiUrl = process.env.EXPO_PUBLIC_API_URL ?? '';

  if (!apiUrl) {
    problems.push('EXPO_PUBLIC_API_URL is not set');
  } else {
    let url: URL | null = null;
    try {
      url = new URL(apiUrl);
    } catch {
      problems.push(`EXPO_PUBLIC_API_URL is not a valid URL`);
    }
    if (url) {
      if (url.protocol !== 'https:') problems.push('EXPO_PUBLIC_API_URL must use https://');
      if (
        /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|0\.0\.0\.0)/.test(url.hostname) ||
        /(^|\.)example\.(com|org|net)$/.test(url.hostname)
      ) {
        problems.push(`EXPO_PUBLIC_API_URL points at a local or placeholder host (${url.hostname})`);
      }
    }
  }

  if (process.env.EXPO_PUBLIC_USE_MOCKS === 'true') {
    problems.push('EXPO_PUBLIC_USE_MOCKS must not be true in production');
  }

  const placeholders: Record<string, string | undefined> = {
    EXPO_PUBLIC_SUPPORT_PHONE: process.env.EXPO_PUBLIC_SUPPORT_PHONE,
    EXPO_PUBLIC_SUPPORT_WHATSAPP: process.env.EXPO_PUBLIC_SUPPORT_WHATSAPP,
    EXPO_PUBLIC_SUPPORT_EMAIL: process.env.EXPO_PUBLIC_SUPPORT_EMAIL,
  };
  for (const [key, value] of Object.entries(placeholders)) {
    if (!value || value === '+201000000000' || /@example\.(com|org|net)$/.test(value)) {
      problems.push(`${key} is missing or still the placeholder value`);
    }
  }

  // Both stores require the privacy policy to be reachable from inside the
  // app, Google Play requires an account-deletion web page, and the About
  // screen links the terms. Without these the About screen silently falls
  // back to emailing support, which is not what a reviewer is looking for.
  const legal: Record<string, string | undefined> = {
    EXPO_PUBLIC_PRIVACY_POLICY_URL: process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL,
    EXPO_PUBLIC_TERMS_URL: process.env.EXPO_PUBLIC_TERMS_URL,
    EXPO_PUBLIC_ACCOUNT_DELETION_URL: process.env.EXPO_PUBLIC_ACCOUNT_DELETION_URL,
  };
  for (const [key, value] of Object.entries(legal)) {
    if (!value) {
      problems.push(`${key} is not set`);
      continue;
    }
    let legalUrl: URL | null = null;
    try {
      legalUrl = new URL(value);
    } catch {
      problems.push(`${key} is not a valid URL`);
    }
    if (legalUrl) {
      if (legalUrl.protocol !== 'https:') problems.push(`${key} must use https://`);
      if (
        /^(localhost|127\.|10\.|192\.168\.|0\.0\.0\.0)/.test(legalUrl.hostname) ||
        /(^|\.)example\.(com|org|net)$/.test(legalUrl.hostname)
      ) {
        problems.push(`${key} points at a local or placeholder host (${legalUrl.hostname})`);
      }
    }
  }

  if (problems.length > 0) {
    throw new Error(
      'Production build refused — fix the EAS environment variables for the ' +
      '"production" environment (eas env:create / expo.dev → Environment variables):\n' +
      problems.map((p) => `  • ${p}`).join('\n')
    );
  }
}

assertProductionEnv();

const NAME: Record<Variant, string> = {
  development: 'EduPlatform (Dev)',
  staging: 'EduPlatform (Stg)',
  production: 'Student Center',
};

const BUNDLE_ID: Record<Variant, string> = {
  development: 'com.eduplatform.app.dev',
  staging: 'com.eduplatform.app.stg',
  production: 'com.eduplatform.app',
};

const SCHEME: Record<Variant, string> = {
  development: 'eduplatform-dev',
  staging: 'eduplatform-stg',
  production: 'eduplatform',
};

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: NAME[VARIANT],
  slug: 'edu-platform-mobile',
  version: '1.0.0',
  orientation: 'default',
  scheme: SCHEME[VARIANT],
  userInterfaceStyle: 'automatic',
  icon: './assets/images/icon.png',

  assetBundlePatterns: ['**/*'],

  ios: {
    supportsTablet: true,
    bundleIdentifier: BUNDLE_ID[VARIANT],
    buildNumber: '1',
    config: {
      // Only standard HTTPS/TLS is used, which is exempt from export
      // documentation. Keep ATS enabled.
      usesNonExemptEncryption: false,
    },
    // Required-reason API declarations for code that ships without its own
    // privacy manifest (react-native-mmkv compiles MMKV from source and uses
    // file-stat APIs). Expo aggregates the manifests of the libraries that do
    // ship one. No tracking, no tracking domains.
    privacyManifests: {
      NSPrivacyTracking: false,
      NSPrivacyTrackingDomains: [],
      NSPrivacyAccessedAPITypes: [
        {
          NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryFileTimestamp',
          NSPrivacyAccessedAPITypeReasons: ['C617.1'],
        },
        {
          NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryUserDefaults',
          NSPrivacyAccessedAPITypeReasons: ['CA92.1'],
        },
        {
          NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategorySystemBootTime',
          NSPrivacyAccessedAPITypeReasons: ['35F9.1'],
        },
      ],
    },
    infoPlist: {
      UIBackgroundModes: ['remote-notification'],
      // Protected content must never continue in PiP / background.
      UIRequiresFullScreen: false,
      // The avatar flow only picks from the library (no camera), and uses the
      // system photo picker. The camera, microphone and Face ID strings that
      // the image-picker / secure-store plugins add by default are removed
      // through their plugin options below — an unused permission string is
      // a question from App Review with no good answer.
      NSPhotoLibraryUsageDescription:
        'Used only if you choose a profile photo from your library.',
    },
  },

  android: {
    package: BUNDLE_ID[VARIANT],
    googleServicesFile:
      process.env.GOOGLE_SERVICES_JSON ?? './google-services.json',
    versionCode: 1,
    adaptiveIcon: {
      foregroundImage: './assets/images/adaptive-icon.png',
      // The mark's own plate. The foreground is the red cog alone, so the
      // launcher composites exactly the logo as it is drawn.
      backgroundColor: '#FBB150',
    },
    permissions: [
      'android.permission.INTERNET',
      'android.permission.ACCESS_NETWORK_STATE',
      'android.permission.POST_NOTIFICATIONS',
      'android.permission.DETECT_SCREEN_CAPTURE',
      'android.permission.DETECT_SCREEN_RECORDING',
    ],
    // Permissions merged in by libraries or the prebuild template that no
    // feature uses. The avatar picker uses the system photo picker, which
    // needs no storage permission; nothing uses the camera; nothing draws
    // over other apps.
    blockedPermissions: [
      'android.permission.RECORD_AUDIO',
      'android.permission.CAMERA',
      'android.permission.SYSTEM_ALERT_WINDOW',
      'android.permission.READ_EXTERNAL_STORAGE',
      'android.permission.WRITE_EXTERNAL_STORAGE',
    ],
    allowBackup: false,
    // The window shrinks when the keyboard opens, so a focused field is never
    // left underneath it. Expo's default is already 'resize', but it was
    // unstated here and Screen.tsx's KeyboardAvoidingView now depends on it:
    // with 'pan' the view would be translated AND resized, double-compensating.
    softwareKeyboardLayoutMode: 'resize',
  },

  plugins: [
    'expo-router',
    [
      'expo-splash-screen',
      {
        // The cog alone, not the lockup. Android 12+ draws this inside a
        // circular mask, which crops a 1.9:1 wordmark at both ends; the cog is
        // square and survives it — and it is the same shape as the launcher
        // icon the student just tapped.
        image: './assets/images/logo-mark.png',
        // Default is 100dp, which is what made the mark look lost on the
        // plate. 192dp is the largest Android guarantees inside the mask.
        imageWidth: 192,
        resizeMode: 'contain',
        backgroundColor: '#FBB150',
      },
    ],
    [
      'expo-secure-store',
      {
        // No biometric unlock in this app — do not add NSFaceIDUsageDescription.
        faceIDPermission: false,
        // Backup rules are owned by plugins/withSecurityHardening.js, which
        // excludes all app data (tokens + device-binding secret) from backup.
        configureAndroidBackup: false,
      },
    ],
    [
      'expo-image-picker',
      {
        photosPermission: 'Used only if you choose a profile photo from your library.',
        cameraPermission: false,
        microphonePermission: false,
      },
    ],
    'expo-localization',
    'expo-font',
    'expo-video',
    [
      'expo-notifications',
      {
        icon: './assets/images/notification-icon.png',
        // Android keeps only this icon's alpha and tints the silhouette. The
        // plate would sit at 1.8:1 on a white notification shade, so the tint
        // is the mark's ink instead.
        color: '#D52027',
      },
    ],
    [
      'expo-build-properties',
      {
        android: {
          minSdkVersion: 24,
          compileSdkVersion: 36,
          targetSdkVersion: 36,
          // Widevine / ExoPlayer DRM support ships with media3 in RN 0.76.
          enableProguardInReleaseBuilds: true,
          enableShrinkResourcesInReleaseBuilds: true,
        },
        ios: {
          deploymentTarget: '16.4',
        },
      },
    ],
    // Local native module implementing FLAG_SECURE / capture detection.
    './modules/content-protection/app.plugin.js',
    // Hardening: disables allowBackup, adds network security config, etc.
    './plugins/withSecurityHardening.js',
  ],

  experiments: {
    typedRoutes: true,
    tsconfigPaths: true,
  },

  updates: {
    // Derived from the EAS project id (this is exactly what
    // `eas update:configure` writes). EXPO_UPDATES_URL still wins if set.
    url:
      process.env.EXPO_UPDATES_URL ||
      (EAS_PROJECT_ID ? `https://u.expo.dev/${EAS_PROJECT_ID}` : undefined),
    fallbackToCacheTimeout: 0,
  },

  runtimeVersion: { policy: 'appVersion' },

  extra: {
    variant: VARIANT,
    ...(EAS_PROJECT_ID ? { eas: { projectId: EAS_PROJECT_ID } } : {}),
  },
});
