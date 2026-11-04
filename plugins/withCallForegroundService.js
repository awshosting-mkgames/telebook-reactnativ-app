// Call ke dauran app background me jaye to Android 11+ mic/camera chup-chaap band kar deta hai (Agora ko silence milta hai).
// Isse bachne ke liye call ke time notifee ka foreground service (microphone [+ camera]) chalta hai.
//   1. FOREGROUND_SERVICE_MICROPHONE / _CAMERA permissions
//   2. notifee ka app.notifee.core.ForegroundService manifest me sirf `shortService` declare hota hai —
//      usko `microphone|camera` se replace karte hain (tools:replace), warna service type mismatch par crash.
const { withAndroidManifest } = require('@expo/config-plugins');

const PERMS = [
  'android.permission.FOREGROUND_SERVICE',
  'android.permission.FOREGROUND_SERVICE_MICROPHONE',
  'android.permission.FOREGROUND_SERVICE_CAMERA',
];

module.exports = (config) => withAndroidManifest(config, (cfg) => {
  const manifest = cfg.modResults.manifest;
  manifest.$['xmlns:tools'] = manifest.$['xmlns:tools'] || 'http://schemas.android.com/tools';

  manifest['uses-permission'] = manifest['uses-permission'] || [];
  PERMS.forEach((name) => {
    if (!manifest['uses-permission'].some((p) => p.$['android:name'] === name)) {
      manifest['uses-permission'].push({ $: { 'android:name': name } });
    }
  });

  const app = manifest.application[0];
  app.service = app.service || [];
  const SVC = 'app.notifee.core.ForegroundService';
  const existing = app.service.find((s) => s.$['android:name'] === SVC);
  const attrs = {
    'android:name': SVC,
    'android:exported': 'false',
    'android:foregroundServiceType': 'microphone|camera',
    'tools:replace': 'android:foregroundServiceType',
  };
  if (existing) Object.assign(existing.$, attrs);
  else app.service.push({ $: attrs });
  return cfg;
});
