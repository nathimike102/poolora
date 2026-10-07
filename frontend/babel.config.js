module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      ['module:react-native-dotenv', {
        envName: 'APP_ENV',
        moduleName: '@env',
        path: '.env',
        safe: false,
        allowUndefined: true,
        verbose: false,
      }],
      // Themed styles repaint natively on a theme change (theme/themed.ts)
      ['react-native-unistyles/plugin', { root: 'src' }],
      'react-native-reanimated/plugin',
    ],
  };
};
