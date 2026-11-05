// Incoming call ko locked / killed phone par dikhane ke liye Android ki do user-controlled settings:
//   1. Full-screen intent (Android 14+ me special access) — iske bina lock screen par poori screen nahi khulti,
//      sirf heads-up notification aata hai.
//   2. Battery optimization — aggressive OEM (Xiaomi/Oppo/Vivo...) app ko kill karke FCM/ring rok dete hain.
// Hum inhe ZABARDASTI on nahi kar sakte; sirf user ko ek baar (7 din me max) settings tak le jaate hain.
import { Alert, NativeModules, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import notifee from '@notifee/react-native';

const { RingtoneModule } = NativeModules;
const ASKED_KEY = 'CALL_READINESS_ASKED_AT';
const ASK_EVERY_MS = 7 * 24 * 60 * 60 * 1000;

export async function getCallReadiness() {
    if (Platform.OS !== 'android') return { fullScreen: true, batteryOptimized: false };
    let fullScreen = true;
    let batteryOptimized = false;
    try { if (RingtoneModule?.canUseFullScreenIntent) fullScreen = !!(await RingtoneModule.canUseFullScreenIntent()); } catch (e) { /* pata nahi → ok maano */ }
    try { batteryOptimized = !!(await notifee.isBatteryOptimizationEnabled()); } catch (e) { /* ignore */ }
    return { fullScreen, batteryOptimized };
}

/** Kuch kam hai to user ko batao (7 din me ek baar). Kabhi throw nahi karta. */
export async function promptCallReadinessIfNeeded() {
    if (Platform.OS !== 'android') return;
    try {
        const last = Number(await AsyncStorage.getItem(ASKED_KEY)) || 0;
        if (Date.now() - last < ASK_EVERY_MS) return;

        const { fullScreen, batteryOptimized } = await getCallReadiness();
        if (fullScreen && !batteryOptimized) return;

        await AsyncStorage.setItem(ASKED_KEY, String(Date.now()));
        const buttons = [{ text: 'Not now', style: 'cancel' }];
        if (!fullScreen) {
            buttons.push({ text: 'Allow full-screen calls', onPress: () => RingtoneModule?.openFullScreenIntentSettings?.() });
        } else {
            buttons.push({ text: 'Battery settings', onPress: () => notifee.openBatteryOptimizationSettings().catch(() => {}) });
        }
        Alert.alert(
            'Get incoming calls reliably',
            !fullScreen
                ? 'Allow full-screen notifications so incoming calls open on your lock screen.'
                : 'Battery optimization may stop calls from ringing when the app is closed. Set Telebook to "Unrestricted" / "Don\'t optimize".',
            buttons,
        );
    } catch (e) {
        console.log('callReadiness error:', e?.message);
    }
}
