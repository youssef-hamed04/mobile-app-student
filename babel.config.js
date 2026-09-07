module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ['babel-preset-expo', { jsxImportSource: 'nativewind' }],
      'nativewind/babel',
    ],
    // Path aliases (@/*) are resolved by Metro via
    // `experiments.tsconfigPaths` in app.config.ts + tsconfig paths,
    // so no module-resolver plugin is required.
    plugins: [
      // react-native-reanimated/plugin must always stay last.
      'react-native-reanimated/plugin',
    ],
  };
};
