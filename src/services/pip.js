// System Picture-in-Picture (Android) — native PipModule (plugins/withPictureInPicture.js).
// Native module na ho (purana build / iOS) to sab no-op, app normal chalta hai.
import { useEffect, useState } from 'react';
import { DeviceEventEmitter, NativeModules, Platform } from 'react-native';

const { PipModule } = NativeModules;
const supported = Platform.OS === 'android' && !!PipModule;

/** Video call connected ho tab true: Home dabate hi PiP window banti hai. */
export const setPipEnabled = (enabled) => {
    if (!supported) return;
    try { PipModule.setEnabled(!!enabled); } catch (e) { /* ignore */ }
};

export const enterPip = () => {
    if (!supported) return;
    try { PipModule.enter(); } catch (e) { /* ignore */ }
};

/** true jab app abhi PiP window me hai */
export const usePipMode = () => {
    const [inPip, setInPip] = useState(false);
    useEffect(() => {
        if (!supported) return undefined;
        const sub = DeviceEventEmitter.addListener('pipModeChanged', (v) => setInPip(!!v));
        PipModule.isInPip?.().then((v) => setInPip(!!v)).catch(() => { });
        return () => sub.remove();
    }, []);
    return inPip;
};
