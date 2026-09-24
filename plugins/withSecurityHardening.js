const {
  withAndroidManifest,
  withDangerousMod,
  withGradleProperties,
  withInfoPlist,
  createRunOncePlugin,
} = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Platform hardening that sits alongside the content-protection module.
 *
 * Android
 *  - network_security_config.xml: TLS only, no user-installed CAs in release
 *    (defeats trivial mitmproxy interception of playback tickets), with a
 *    debug-only exception so a dev machine can still proxy against staging.
 *  - data_extraction_rules.xml: excludes the Keystore-backed prefs and the
 *    app database from cloud backup and device-to-device transfer.
 *  - Disables cleartext traffic and debuggable release builds.
 *
 * iOS
 *  - ATS: TLS 1.2 minimum, forward secrecy required, no arbitrary loads.
 *  - Disables the "file sharing" surfaces so downloaded material can't be
 *    pulled out over USB.
 */

/**
 * Local-network cleartext is a development convenience (Android emulator →
 * 10.0.2.2, a backend on localhost). It must not be present in a store
 * build: even scoped to loopback addresses, a release manifest that permits
 * cleartext is flagged by Play pre-launch reports and security reviews, and
 * the production API is HTTPS-only.
 */
const IS_PRODUCTION_VARIANT = process.env.APP_VARIANT === 'production';

const LOCAL_CLEARTEXT_DOMAINS = IS_PRODUCTION_VARIANT
  ? ''
  : `
  <!-- Non-production variants only: a local dev backend over http. -->
  <domain-config cleartextTrafficPermitted="true">
    <domain includeSubdomains="true">10.0.2.2</domain>
    <domain includeSubdomains="true">localhost</domain>
    <domain includeSubdomains="true">127.0.0.1</domain>
  </domain-config>
`;

const NETWORK_SECURITY_CONFIG = `<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
  <!-- Release: system CAs only. A user-installed root (proxy) is rejected,
       so playback tickets and signed manifest URLs cannot be captured with
       an off-the-shelf interception proxy. -->
  <base-config cleartextTrafficPermitted="false">
    <trust-anchors>
      <certificates src="system" />
    </trust-anchors>
  </base-config>

  <!-- Debug builds only: allows a local proxy. -->
  <debug-overrides>
    <trust-anchors>
      <certificates src="system" />
      <certificates src="user" />
    </trust-anchors>
  </debug-overrides>
${LOCAL_CLEARTEXT_DOMAINS}</network-security-config>
`;

const DATA_EXTRACTION_RULES = `<?xml version="1.0" encoding="utf-8"?>
<data-extraction-rules>
  <cloud-backup>
    <exclude domain="sharedpref" path="." />
    <exclude domain="database" path="." />
    <exclude domain="file" path="." />
  </cloud-backup>
  <device-transfer>
    <exclude domain="sharedpref" path="." />
    <exclude domain="database" path="." />
    <exclude domain="file" path="." />
  </device-transfer>
</data-extraction-rules>
`;

function withAndroidXmlResources(config) {
  return withDangerousMod(config, [
    'android',
    async (cfg) => {
      const xmlDir = path.join(
        cfg.modRequest.platformProjectRoot,
        'app',
        'src',
        'main',
        'res',
        'xml'
      );
      fs.mkdirSync(xmlDir, { recursive: true });
      fs.writeFileSync(
        path.join(xmlDir, 'network_security_config.xml'),
        NETWORK_SECURITY_CONFIG
      );
      fs.writeFileSync(
        path.join(xmlDir, 'data_extraction_rules.xml'),
        DATA_EXTRACTION_RULES
      );
      return cfg;
    },
  ]);
}

function withAndroidManifestHardening(config) {
  return withAndroidManifest(config, (cfg) => {
    const app = cfg.modResults.manifest.application?.[0];
    if (!app) return cfg;

    app.$['android:usesCleartextTraffic'] = 'false';
    app.$['android:allowBackup'] = 'false';
    app.$['android:networkSecurityConfig'] = '@xml/network_security_config';
    app.$['android:dataExtractionRules'] = '@xml/data_extraction_rules';
    // android:enableOnBackInvokedCallback is intentionally NOT forced here.
    // Expo owns it through `android.predictiveBackGestureEnabled` (default
    // false), which is the configuration React Native's back handling and
    // expo-router's Android back button are tested against. Forcing it to
    // true had no content-protection effect.

    return cfg;
  });
}

function withGradleHardening(config) {
  return withGradleProperties(config, (cfg) => {
    const set = (key, value) => {
      const existing = cfg.modResults.find(
        (p) => p.type === 'property' && p.key === key
      );
      if (existing) existing.value = value;
      else cfg.modResults.push({ type: 'property', key, value });
    };

    set('android.enableR8.fullMode', 'true');
    // The locale/encoding flags keep Gradle's code generators (Room/KSP in
    // expo-updates) from emitting Arabic-Indic digits on a machine whose
    // system locale is Arabic, which breaks local release builds.
    set(
      'org.gradle.jvmargs',
      '-Xmx4096m -XX:MaxMetaspaceSize=1024m -Duser.language=en -Duser.country=US -Dfile.encoding=UTF-8'
    );
    return cfg;
  });
}

function withIOSHardening(config) {
  return withInfoPlist(config, (cfg) => {
    cfg.modResults.NSAppTransportSecurity = {
      NSAllowsArbitraryLoads: false,
      // Local-network http is only needed to reach a dev backend.
      NSAllowsLocalNetworking: !IS_PRODUCTION_VARIANT,
      NSExceptionDomains: {},
    };

    // Prevent lesson material from being extracted over USB / Files.app.
    cfg.modResults.UIFileSharingEnabled = false;
    cfg.modResults.LSSupportsOpeningDocumentsInPlace = false;

    return cfg;
  });
}

const withSecurityHardening = (config) => {
  config = withAndroidXmlResources(config);
  config = withAndroidManifestHardening(config);
  config = withGradleHardening(config);
  config = withIOSHardening(config);
  return config;
};

module.exports = createRunOncePlugin(
  withSecurityHardening,
  'security-hardening',
  '1.0.0'
);
