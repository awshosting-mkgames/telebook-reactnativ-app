/**
 * lockScreenModule.js — android/.../LockScreenModule.kt ka thin JS wrapper.
 *
 * InCallScreen isi se incoming call ke waqt MainActivity ko lock screen ke
 * upar dikhata hai (WhatsApp jaisa) — sirf jab tak ring/active-call screen
 * khuli hai, warna normal app-open par lock screen bypass ho jaata (privacy
 * issue), isliye yeh flag turant unmount/call-end par wapas off hota hai.
 */

import { NativeModules, Platform } from 'react-native';

const { LockScreenModule } = NativeModules;

export function showOverLockScreen(show) {
    if (Platform.OS !== 'android' || !LockScreenModule) return;
    try {
        LockScreenModule.showOverLockScreen(!!show);
    } catch (e) {
        console.warn('[lockScreenModule] error:', e?.message);
    }
}
