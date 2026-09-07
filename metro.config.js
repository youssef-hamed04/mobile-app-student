const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// HLS playlists / keys must never be bundled as assets.
config.resolver.assetExts = config.resolver.assetExts.filter(
  (ext) => !['m3u8', 'ts', 'key'].includes(ext)
);

config.resolver.sourceExts = [...config.resolver.sourceExts, 'mjs', 'cjs'];

module.exports = withNativeWind(config, {
  input: './src/theme/global.css',
  inlineRem: 16,
});
