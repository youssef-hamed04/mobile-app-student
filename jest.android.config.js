/**
 * The whole test suite on the Android platform, which is what the Google Play
 * release runs on. `Platform.OS` is 'android' and the release flags take effect.
 *
 *   npx jest --config jest.android.config.js
 */
// eslint-disable-next-line @typescript-eslint/no-require-imports -- Jest config runs as CommonJS
const base = require('./jest.config');

module.exports = { ...base, preset: 'jest-expo/android' };
