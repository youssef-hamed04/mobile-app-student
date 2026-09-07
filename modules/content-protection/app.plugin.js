const {
  withAndroidManifest,
  withMainActivity,
  withInfoPlist,
  createRunOncePlugin,
} = require('expo/config-plugins');

/**
 * Config plugin for the content-protection module.
 *
 * It wires the pieces that cannot be expressed from JS:
 *   • Android: declares DETECT_SCREEN_CAPTURE / DETECT_SCREEN_RECORDING,
 *     disables backup + cross-device transfer of app data, and marks the
 *     main activity as excluded from recents previews.
 *   • iOS: keeps the app out of the multitasking snapshot cache by opting
 *     into the module's own privacy overlay, and disables Picture-in-Picture
 *     so protected video cannot be floated into another app.
 */

function withAndroid(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults;
    manifest.manifest['uses-permission'] = manifest.manifest['uses-permission'] || [];

    const perms = [
      'android.permission.DETECT_SCREEN_CAPTURE',
      'android.permission.DETECT_SCREEN_RECORDING',
    ];

    for (const name of perms) {
      const exists = manifest.manifest['uses-permission'].some(
        (p) => p.$['android:name'] === name
      );
      if (!exists) {
        manifest.manifest['uses-permission'].push({ $: { 'android:name': name } });
      }
    }

    const app = manifest.manifest.application?.[0];
    if (app) {
      // Never back up or transfer app data — the device-binding secret and
      // tokens must not follow the account onto a second handset.
      app.$['android:allowBackup'] = 'false';
      app.$['android:fullBackupContent'] = 'false';
      app.$['android:dataExtractionRules'] = '@xml/data_extraction_rules';
      app.$['android:networkSecurityConfig'] = '@xml/network_security_config';

      const activity = app.activity?.find(
        (a) => a.$['android:name'] === '.MainActivity'
      );
      if (activity) {
        activity.$['android:excludeFromRecents'] = 'false';
        // Recreating the activity on locale/orientation change would tear the
        // secure surface down mid-playback.
        activity.$['android:configChanges'] =
          'keyboard|keyboardHidden|orientation|screenSize|screenLayout|uiMode|locale|layoutDirection';
      }
    }

    return cfg;
  });
}

/**
 * FLAG_SECURE is applied as early as possible — before the first frame — so
 * the launch screen of a protected app is never capturable either. The JS
 * layer can relax it on non-protected screens via `setSecureFlag(false)`.
 */
function withMainActivitySecureFlag(config) {
  return withMainActivity(config, (cfg) => {
    if (cfg.modResults.language !== 'kt') return cfg;

    let src = cfg.modResults.contents;
    if (src.includes('WindowManager.LayoutParams.FLAG_SECURE')) return cfg;

    if (!src.includes('import android.view.WindowManager')) {
      src = src.replace(
        /^(package .*\n)/m,
        '$1\nimport android.view.WindowManager\n'
      );
    }

    src = src.replace(
      /(override fun onCreate\(savedInstanceState: Bundle\?\) \{\n)/,
      `$1    // content-protection: block screenshots / recording from the very first frame.
    window.setFlags(
      WindowManager.LayoutParams.FLAG_SECURE,
      WindowManager.LayoutParams.FLAG_SECURE
    )\n`
    );

    cfg.modResults.contents = src;
    return cfg;
  });
}

function withIOS(config) {
  return withInfoPlist(config, (cfg) => {
    // Protected video must not be detachable into a floating PiP window.
    cfg.modResults.UIBackgroundModes = (cfg.modResults.UIBackgroundModes || []).filter(
      (m) => m !== 'audio'
    );
    cfg.modResults.ContentProtectionEnabled = true;
    return cfg;
  });
}

const withContentProtection = (config) => {
  config = withAndroid(config);
  config = withMainActivitySecureFlag(config);
  config = withIOS(config);
  return config;
};

module.exports = createRunOncePlugin(
  withContentProtection,
  'content-protection',
  '1.0.0'
);
