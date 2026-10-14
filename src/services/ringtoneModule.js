/**
 * ringtoneModule.js — android/.../RingtoneModule.kt ka thin JS wrapper.
 *
 * Foreground mein `call:incoming` aane par IncomingCallManager/InCallScreen
 * ring UI dikhate hain par khud silent hote hain (notifee sound sirf
 * background/killed push ke liye hai) — yeh device ka default ringtone
 * play/stop karta hai taaki foreground mein bhi WhatsApp jaisa baje.
 */

import { NativeModules, Platform } from 'react-native';

const { RingtoneModule } = NativeModules;

export function playRingtone() {
    if (Platform.OS !== 'android' || !RingtoneModule) return;
    try {
        RingtoneModule.playRingtone();
    } catch (e) {
        console.warn('[ringtoneModule] play error:', e?.message);
    }
}

export function stopRingtone() {
    if (Platform.OS !== 'android' || !RingtoneModule) return;
    try {
        RingtoneModule.stopRingtone();
    } catch (e) {
        console.warn('[ringtoneModule] stop error:', e?.message);
    }
}
