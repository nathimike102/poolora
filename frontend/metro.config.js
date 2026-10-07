const { getDefaultConfig } = require('expo/metro-config');

/**
 * Expo's defaults already resolve .ts/.tsx/.mjs/.cjs and every asset type the
 * app uses. The previous overrides replaced those lists wholesale and dropped
 * extensions Expo adds (.svg, .cjs source, web variants), so they are gone.
 *
 * Inline requires: a module runs the first time something uses it, not at
 * start-up, so the sixty-odd screens cost nothing until they are opened.
 * Anything that must run at start-up for its side effect (themes, i18n, the
 * background location tasks) is imported bare in index.ts or App.tsx, which
 * keeps it eager.
 */
const config = getDefaultConfig(__dirname);
const getTransformOptions = config.transformer.getTransformOptions;
config.transformer.getTransformOptions = async (...args) => {
  const options = await getTransformOptions(...args);
  return { ...options, transform: { ...options.transform, inlineRequires: true } };
};

module.exports = config;
