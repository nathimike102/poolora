const { getDefaultConfig } = require('expo/metro-config');

/**
 * Expo's defaults already resolve .ts/.tsx/.mjs/.cjs and every asset type the
 * app uses. The previous overrides replaced those lists wholesale and dropped
 * extensions Expo adds (.svg, .cjs source, web variants), so they are gone.
 */
module.exports = getDefaultConfig(__dirname);
