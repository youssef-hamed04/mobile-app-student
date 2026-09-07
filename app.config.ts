import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * Environment-aware Expo config.
 *
 * APP_VARIANT is provided by the EAS build profile (see eas.json) or by the
 * shell when running locally:  APP_VARIANT=staging npx expo start
 */
type Variant = 'development' | 'staging' | 'production';

const VARIANT = (process.env.APP_VARIANT as Variant) ?? 'development';

const NAME: Record<Variant, string> = {
  development: 'EduPlatform (Dev)',
  staging: 'EduPlatform (Stg)',
  production: 'EduPlatform',
};
{
  "expo": {
    "name": "edu-mobile",
    "newArchEnabled": true
  }
}

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
      // Required for HLS delivered over https only. Keep ATS enabled.
      usesNonExemptEncryption: false,
    },
    infoPlist: {
      UIBackgroundModes: ['remote-notification'],
      // Protected content must never continue in PiP / background.
      UIRequiresFullScreen: false,
      NSCameraUsageDescription:
        'Used only if you choose to take a profile photo.',
      NSPhotoLibraryUsageDescription:
        'Used only if you choose a profile photo from your library.',
    },
  },

  android: {
    package: BUNDLE_ID[VARIANT],
    versionCode: 1,
    adaptiveIcon: {
      foregroundImage: './assets/images/adaptive-icon.png',
      backgroundColor: '#0B0B0D',
    },
    permissions: [
      'android.permission.INTERNET',
      'android.permission.ACCESS_NETWORK_STATE',
      'android.permission.POST_NOTIFICATIONS',
      'android.permission.DETECT_SCREEN_CAPTURE',
      'android.permission.DETECT_SCREEN_RECORDING',
    ],
    blockedPermissions: ['android.permission.RECORD_AUDIO'],
    allowBackup: false,
  },

  plugins: [
    'expo-router',
    [
      'expo-splash-screen',
      {
        image: './assets/images/splash.png',
        resizeMode: 'contain',
        backgroundColor: '#0B0B0D',
      },
    ],
    'expo-secure-store',
    'expo-localization',
    'expo-font',
    'expo-video',
    [
      'expo-notifications',
      {
        icon: './assets/images/notification-icon.png',
        color: '#F26A1B',
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
    // Set after `eas update:configure`.
    url: process.env.EXPO_UPDATES_URL,
    fallbackToCacheTimeout: 0,
  },

  runtimeVersion: { policy: 'appVersion' },

  extra: {
    variant: VARIANT,
    eas: {
      projectId: process.env.EAS_PROJECT_ID ?? '00000000-0000-0000-0000-000000000000',
    },
  },
});
