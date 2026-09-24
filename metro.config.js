const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// HLS playlists / keys must never be bundled as assets.
config.resolver.assetExts = config.resolver.assetExts.filter(
  (ext) => !['m3u8', 'ts', 'key'].includes(ext)
);

config.resolver.sourceExts = [...config.resolver.sourceExts, 'mjs', 'cjs'];

/*
 * Several Expo packages ship Gradle plugins, and Gradle writes its build
 * output *inside* node_modules. A native build therefore creates and deletes
 * directories under a tree Metro is watching, and the watcher dies on the
 * stale path with ENOENT — Metro exits mid-session and the next reload hangs
 * with no obvious cause. These paths hold no JS, so nothing is lost by
 * refusing to watch or resolve them.
 */
const gradleOutput = /node_modules[\\/].*[\\/]build[\\/](classes|tmp|libs|kotlin|intermediates)[\\/].*/;

config.resolver.blockList = [
  ...(Array.isArray(config.resolver.blockList)
    ? config.resolver.blockList
    : config.resolver.blockList
      ? [config.resolver.blockList]
      : []),
  gradleOutput,
];

module.exports = withNativeWind(config, {
  input: './src/theme/global.css',
  inlineRem: 16,
});
