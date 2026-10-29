/**
 * ringtoneModule.js — incoming call ringtone.
 *
 * Pehle sirf custom native module (RingtoneModule.kt) tha. Woh `android/` folder me hai jo
 * git-ignored hai aur EAS build me prebuild se dobara bante waqt include nahi hota
 * (package bhi com.telebookapp.chatapp ho gaya) — isliye release build me ringtone silent thi
 * (Point 7). Ab native module mile to wahi, warna bundled JS ringtone (expo-audio, loop) +
 * vibration. Dono rasta `playRingtone()/stopRingtone()` ke peeche hain.
 */

import { NativeModules, Platform, Vibration } from 'react-native';
import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';

const { RingtoneModule } = NativeModules;
const RING_ASSET = require('../../assets/sounds/ringtone.wav');
const VIBE_PATTERN = [0, 800, 1200]; // 0.8s buzz, 1.2s pause — repeat

let jsPlayer = null;
let ringing = false;

const stopJs = () => {
    try { Vibration.cancel(); } catch (e) { /* ignore */ }
    if (jsPlayer) {
        try { jsPlayer.pause(); jsPlayer.remove?.(); } catch (e) { /* already released */ }
        jsPlayer = null;
    }
};

const playJs = async () => {
    try {
        await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false, shouldPlayInBackground: false });
        if (!ringing) return; // await ke beech stop aa gaya
        jsPlayer = createAudioPlayer(RING_ASSET);
        jsPlayer.loop = true;
        jsPlayer.volume = 1;
        jsPlayer.play();
        if (Platform.OS === 'android') Vibration.vibrate(VIBE_PATTERN, true);
    } catch (e) {
        console.warn('[ringtoneModule] js play error:', e?.message);
    }
};

export function playRingtone() {
    ringing = true;
    stopJs();
    if (Platform.OS === 'android' && RingtoneModule) {
        try {
            RingtoneModule.playRingtone();
            return;
        } catch (e) {
            console.warn('[ringtoneModule] native play error:', e?.message);
        }
    }
    playJs();
}

export function stopRingtone() {
    ringing = false;
    stopJs();
    if (Platform.OS === 'android' && RingtoneModule) {
        try { RingtoneModule.stopRingtone(); } catch (e) { console.warn('[ringtoneModule] stop error:', e?.message); }
    }
}
