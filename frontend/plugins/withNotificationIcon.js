/**
 * The small icon and colour Android shows for Firebase push notifications.
 * Expo's old top-level `notification` setting is gone, and Firebase reads these
 * from manifest entries, so this copies the icon into the app's resources and
 * adds the entries. The icon must be white on transparent.
 */
const fs = require('fs');
const path = require('path');
const { AndroidConfig, withAndroidManifest, withAndroidColors, withDangerousMod } = require('@expo/config-plugins');

const ICON = 'notification_icon';
const COLOR = 'notification_icon_color';

function setMetaData(app, name, attrs) {
  app['meta-data'] = (app['meta-data'] ?? []).filter((m) => m.$['android:name'] !== name);
  app['meta-data'].push({ $: { 'android:name': name, ...attrs, 'tools:replace': Object.keys(attrs).join(',') } });
}

module.exports = function withNotificationIcon(config, { icon, color }) {
  config = withDangerousMod(config, [
    'android',
    async (c) => {
      const dir = path.join(c.modRequest.platformProjectRoot, 'app/src/main/res/drawable');
      fs.mkdirSync(dir, { recursive: true });
      fs.copyFileSync(path.resolve(c.modRequest.projectRoot, icon), path.join(dir, `${ICON}.png`));
      return c;
    },
  ]);
  config = withAndroidColors(config, (c) => {
    c.modResults = AndroidConfig.Colors.assignColorValue(c.modResults, { name: COLOR, value: color });
    return c;
  });
  return withAndroidManifest(config, (c) => {
    const manifest = c.modResults.manifest;
    manifest.$['xmlns:tools'] = manifest.$['xmlns:tools'] ?? 'http://schemas.android.com/tools';
    const app = AndroidConfig.Manifest.getMainApplicationOrThrow(c.modResults);
    setMetaData(app, 'com.google.firebase.messaging.default_notification_icon', { 'android:resource': `@drawable/${ICON}` });
    setMetaData(app, 'com.google.firebase.messaging.default_notification_color', { 'android:resource': `@color/${COLOR}` });
    return c;
  });
};
