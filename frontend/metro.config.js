const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Ensure TypeScript files and potential ESM modules are properly resolved
config.resolver.sourceExts = ['tsx', 'ts', 'jsx', 'js', 'json', 'mjs', 'cjs'];
config.resolver.assetExts = [...config.resolver.assetExts, 'glb', 'gltf', 'png', 'jpg'];

module.exports = config;
