import * as fs from 'fs';
import * as path from 'path';

/**
 * App-wide content protection wiring.
 *
 *   1. `initialize()` arms the secure flag for the whole app. On iOS that is
 *      what turns on the app-switcher privacy overlay from launch: it used to
 *      wait for the first protected screen's `acquire()`.
 *   2. Nothing in the app ever turns the flag OFF. FLAG_SECURE is set before
 *      the first frame in MainActivity and must stay set for every screen.
 *   3. On iOS the privacy shield covers the app while the screen is recorded
 *      or mirrored; on Android FLAG_SECURE already blanks the window.
 */

const ROOT = path.resolve(__dirname, '..');
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

describe('contentProtection.initialize', () => {
  it('turns the secure flag on once, app-wide, and never off', async () => {
    const setSecureFlag = jest.fn(async (enabled: boolean) => enabled);

    await jest.isolateModulesAsync(async () => {
      jest.doMock('@modules/content-protection', () => ({
        ...jest.requireActual('@modules/content-protection/src/index.web.ts'),
        capabilities: {
          isSupported: true,
          platform: 'ios',
          supportsSecureFlag: false,
          supportsCaptureDetection: true,
          supportsRecordingDetection: true,
          supportsSecureSurface: true,
        },
        setSecureFlag,
      }));

      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { contentProtection } = require('@/services/content-protection');
      await contentProtection.initialize();
      // A second call (fast refresh, remount) must not toggle anything.
      await contentProtection.initialize();
    });

    expect(setSecureFlag).toHaveBeenCalledTimes(1);
    expect(setSecureFlag).toHaveBeenCalledWith(true);
  });

  it('no app source ever clears the secure flag', () => {
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (/\.(ts|tsx)$/.test(entry.name)) {
          if (/setSecureFlag\(\s*false\s*\)/.test(fs.readFileSync(full, 'utf8'))) {
            offenders.push(path.relative(ROOT, full));
          }
        }
      }
    };
    walk(path.join(ROOT, 'src'));
    expect(offenders).toEqual([]);
  });

  it('the config plugin applies FLAG_SECURE in MainActivity for every build type', () => {
    const plugin = read('modules/content-protection/app.plugin.js');
    expect(plugin).toMatch(/window\.setFlags\(\s*WindowManager\.LayoutParams\.FLAG_SECURE/);
    // No debug-only escape hatch around the flag.
    expect(plugin).not.toMatch(/BuildConfig\.DEBUG/);
  });
});

describe('PrivacyShield capture cover', () => {
  // Required lazily: loading it at collection time would load the protection
  // module before the isolated registry above can mock it.
  const coversForCapture = (os: string, state: { recording: boolean; externalDisplay: boolean }) =>
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('@/components/feedback/PrivacyShield').coversForCapture(os, state);

  it.each([
    ['ios', { recording: true, externalDisplay: false }, true],
    ['ios', { recording: false, externalDisplay: true }, true],
    ['ios', { recording: false, externalDisplay: false }, false],
    // FLAG_SECURE already blanks the Android window; no app-wide cover.
    ['android', { recording: true, externalDisplay: true }, false],
  ])('%s %o -> %s', (os, state, expected) => {
    expect(coversForCapture(os, state)).toBe(expected);
  });
});

describe('playback speed keeps the voice pitch', () => {
  const player = read('src/features/video/ProtectedVideoPlayer.tsx');

  it('expo-video defaults pitch correction OFF on Android, so the app must turn it on', () => {
    const native = read(
      'node_modules/expo-video/android/src/main/java/expo/modules/video/player/VideoPlayer.kt'
    );
    // If this ever flips upstream the explicit setting below stays harmless.
    expect(native).toMatch(/var preservesPitch = false/);
  });

  it('sets preservesPitch before the rate when a native player is created', () => {
    const setup = player.slice(player.indexOf('const configurePlayer'));
    const pitch = setup.indexOf('p.preservesPitch = true');
    const rate = setup.indexOf('p.playbackRate = ');
    expect(pitch).toBeGreaterThan(-1);
    expect(rate).toBeGreaterThan(pitch);
  });

  it('re-applies pitch correction whenever the speed changes', () => {
    expect(player).toMatch(
      /player\.preservesPitch = true;\s*player\.playbackRate = rate;/
    );
  });
});

describe('iOS protection wiring', () => {
  const secureView = read('modules/content-protection/ios/SecureContentView.swift');

  it('mounts New Architecture children inside the secure canvas, not beside it', () => {
    // React Native 0.86 renders only with Fabric, which mounts children through
    // mountChildComponentView and never calls insertReactSubview.
    expect(secureView).toMatch(
      /override func mountChildComponentView\(_ childComponentView: UIView, index: Int\) \{\s*contentHost\.insertSubview\(childComponentView, at: index\)/
    );
    expect(secureView).toMatch(/override func unmountChildComponentView\(_ childComponentView: UIView, index: Int\)/);
  });

  it('routes touches into the hosted content past the non-interactive text field', () => {
    expect(secureView).toMatch(/field\.isUserInteractionEnabled = false/);
    expect(secureView).toMatch(/override func hitTest\(_ point: CGPoint, with event: UIEvent\?\) -> UIView\?/);
    expect(secureView).toMatch(/contentHost\.hitTest\(local, with: event\)/);
  });

  it('keeps protected video off AirPlay routing', () => {
    expect(read('src/features/video/ProtectedVideoPlayer.tsx')).toMatch(/p\.allowsExternalPlayback = false;/);
  });

  it('the attachment PDF page may load on iOS (base-URL navigation is allowed)', () => {
    const viewer = read('src/app/viewer/[attachmentId].tsx');
    expect(viewer).toMatch(/req\.url === origin \|\| req\.url === `\$\{origin\}\/`/);
  });

  it('localizes the native privacy overlay and the photo permission prompt', () => {
    expect(read('modules/content-protection/ios/ContentProtectionModule.swift')).toMatch(
      /label\.text = privacyOverlayText/
    );
    expect(read('src/components/feedback/PrivacyShield.tsx')).toMatch(
      /setPrivacyOverlayText\(overlayText\)/
    );
    const ar = JSON.parse(read('assets/locales/ios/ar.json'));
    expect(ar.ios.NSPhotoLibraryUsageDescription).toMatch(/[؀-ۿ]/);
    // Only under `ios`: Expo writes top-level locale keys into Android's
    // values-b+ar/strings.xml too, where an iOS-only key fails the release
    // lint (ExtraTranslation) and the Android build (EAS af200148, vc 12).
    expect(Object.keys(ar)).toEqual(['ios']);
    expect(read('app.config.ts')).toMatch(/ar: '\.\/assets\/locales\/ios\/ar\.json'/);
  });
});
