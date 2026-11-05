// User ki chuni hui incoming-call ringtone (Android).
//  * System ka ringtone picker (native RingtoneModule.pickRingtone) se chunte hain.
//  * Background/killed ring notification channel ki sound se bajti hai, aur channel ki sound baad me badli nahi jaa sakti
//    → har ringtone ke liye nayi channel (RingtoneModule.createCallChannel), purani hata dete hain.
//  * App khula ho to ringtoneModule.js yahi uri expo-audio se bajata hai.
// Kuch chuna nahi to pehle jaisa: Telebook ki bundled ringtone + default channel.
import { NativeModules, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import notifee from '@notifee/react-native';

const { RingtoneModule } = NativeModules;
const KEY = 'CALL_RINGTONE';

let cache; // undefined = abhi padha nahi, null = default

export async function getCallRingtone() {
    if (Platform.OS !== 'android') return null;
    if (cache !== undefined) return cache;
    try {
        const raw = await AsyncStorage.getItem(KEY);
        const v = raw ? JSON.parse(raw) : null;
        cache = v?.uri && v?.channelId ? v : null;
    } catch (e) { cache = null; }
    return cache;
}

const deleteChannel = async (id) => { try { if (id) await notifee.deleteChannel(id); } catch (e) { /* pehle se nahi */ } };

/** Picker kholo. Chuni to { uri, title, channelId } save+return, cancel par null. */
export async function pickCallRingtone() {
    if (Platform.OS !== 'android' || !RingtoneModule?.pickRingtone || !RingtoneModule?.createCallChannel) {
        throw new Error('NOT_SUPPORTED');   // purana build jisme native method nahi
    }
    const prev = await getCallRingtone();
    const picked = await RingtoneModule.pickRingtone(prev?.uri || null);
    if (!picked?.uri) return null;
    const channelId = `incoming_calls_u_${Date.now()}`;
    await RingtoneModule.createCallChannel(channelId, picked.uri);
    const next = { uri: picked.uri, title: picked.title || 'Custom ringtone', channelId };
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
    cache = next;
    await deleteChannel(prev?.channelId);
    return next;
}

/** Wapas Telebook default */
export async function resetCallRingtone() {
    const prev = await getCallRingtone();
    cache = null;
    try { await AsyncStorage.removeItem(KEY); } catch (e) { /* ignore */ }
    await deleteChannel(prev?.channelId);
}

/** Chuni hui channel system/clear-data se gayab ho gayi ho to dobara banao; na ban sake to null (default par girna) */
export async function ensureCustomChannel() {
    const r = await getCallRingtone();
    if (!r) return null;
    try {
        const ch = await notifee.getChannel(r.channelId);
        if (!ch) await RingtoneModule.createCallChannel(r.channelId, r.uri);
        return r;
    } catch (e) { return null; }
}
