// Library manifests se aane wali foreground-service permissions hatao jinka app
// me use nahi hai — warna Play Console har ek ke liye declaration + video maangta hai.
//   MEDIA_PROJECTION → Agora screen-share (app me screen share nahi hai)
//   MEDIA_PLAYBACK   → expo-audio lock-screen controls service (app sirf in-chat voice note chalata hai)
// Saath me baaki unused permissions bhi (library manifests se aati hain):
//   SYSTEM_ALERT_WINDOW, SCHEDULE_EXACT_ALARM (koi scheduled notification nahi),
//   READ_MEDIA_AUDIO, ACCESS_MEDIA_LOCATION (audio library / photo location use nahi hoti)
const { withAndroidManifest } = require('@expo/config-plugins');

const REMOVE_PERMISSIONS = [
    'android.permission.FOREGROUND_SERVICE_MEDIA_PROJECTION',
    'android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK',
    'android.permission.SYSTEM_ALERT_WINDOW',
    'android.permission.SCHEDULE_EXACT_ALARM',
    'android.permission.READ_MEDIA_AUDIO',
    'android.permission.ACCESS_MEDIA_LOCATION',
];
const REMOVE_SERVICES = ['expo.modules.audio.service.AudioControlsService'];

module.exports = (config) =>
    withAndroidManifest(config, (cfg) => {
        const manifest = cfg.modResults.manifest;
        manifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';

        manifest['uses-permission'] = (manifest['uses-permission'] || []).filter(
            (p) => !REMOVE_PERMISSIONS.includes(p.$['android:name'])
        );
        REMOVE_PERMISSIONS.forEach((name) =>
            manifest['uses-permission'].push({ $: { 'android:name': name, 'tools:node': 'remove' } })
        );

        const app = manifest.application[0];
        app.service = (app.service || []).filter((s) => !REMOVE_SERVICES.includes(s.$['android:name']));
        REMOVE_SERVICES.forEach((name) =>
            app.service.push({ $: { 'android:name': name, 'tools:node': 'remove' } })
        );
        return cfg;
    });
