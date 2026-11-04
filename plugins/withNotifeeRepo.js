// notifee ka `app.notifee:core` Maven par nahi, package ke andar android/libs me bundled hai.
// Prebuild ke baad root build.gradle me ye repo na ho to Gradle "Could not find app.notifee:core" deta hai.
const { withProjectBuildGradle } = require('@expo/config-plugins');

const LINE = `maven { url "$rootDir/../node_modules/@notifee/react-native/android/libs" }`;

module.exports = (config) => withProjectBuildGradle(config, (cfg) => {
  if (cfg.modResults.language === 'groovy' && !cfg.modResults.contents.includes('@notifee/react-native/android/libs')) {
    cfg.modResults.contents = cfg.modResults.contents.replace(
      /allprojects\s*\{\s*repositories\s*\{/,
      (m) => `${m}\n    ${LINE}`
    );
  }
  return cfg;
});
