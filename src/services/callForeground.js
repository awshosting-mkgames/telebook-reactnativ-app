// Call ke dauran foreground service (microphone [+ camera]) — warna app background me jate hi Android
// mic/camera band kar deta hai aur dusre ko audio/video mute lagta hai. Manifest: plugins/withCallForegroundService.js
import { Platform } from 'react-native';
import notifee, { AndroidCategory, AndroidForegroundServiceType, AndroidImportance } from '@notifee/react-native';

const CHANNEL_ID = 'call_in_progress';
const NOTIF_ID = 'active_call_fgs';
let running = false;

// App start par ek baar (src/index.js). Promise kabhi resolve nahi hota — service tab tak chalti hai jab tak
// stopForegroundService() na bulaya jaye.
export const registerCallForegroundService = () => {
    if (Platform.OS !== 'android') return;
    try { notifee.registerForegroundService(() => new Promise(() => {})); } catch (e) { /* notifee na ho to chup */ }
};

export const startCallForeground = async ({ isVideo = false, name } = {}) => {
    if (Platform.OS !== 'android' || running) return;
    try {
        await notifee.createChannel({ id: CHANNEL_ID, name: 'Ongoing call', importance: AndroidImportance.LOW, vibration: false });
        const types = [AndroidForegroundServiceType.FOREGROUND_SERVICE_TYPE_MICROPHONE];
        if (isVideo) types.push(AndroidForegroundServiceType.FOREGROUND_SERVICE_TYPE_CAMERA);
        await notifee.displayNotification({
            id: NOTIF_ID,
            title: isVideo ? 'Video call in progress' : 'Voice call in progress',
            body: name ? `Call with ${name} — tap to return` : 'Tap to return to the call',
            android: {
                channelId: CHANNEL_ID,
                asForegroundService: true,
                foregroundServiceTypes: types,
                ongoing: true,
                onlyAlertOnce: true,
                category: AndroidCategory.CALL,
                smallIcon: 'ic_launcher',
                pressAction: { id: 'default', launchActivity: 'default' },
            },
        });
        running = true;
    } catch (e) {
        console.log('[callForeground] start failed:', e?.message);
    }
};

export const stopCallForeground = async () => {
    if (Platform.OS !== 'android' || !running) return;
    running = false;
    try { await notifee.stopForegroundService(); } catch (e) { /* already stopped */ }
};
