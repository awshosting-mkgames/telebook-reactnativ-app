// Android status bar fix (edge-to-edge).
//
// App edge-to-edge chalta hai (android/gradle.properties edgeToEdgeEnabled=true, aur Android 15+ par
// system ise zabardasti lagata hai), isliye content status bar ke neeche tak failta hai. Bahut se screens
// header par `paddingTop: StatusBar.currentHeight` lagate hain, par:
//   - StatusBar.currentHeight sirf resource wali height hai: cutout / punch-hole wale phones par asli
//     inset se chhoti, aur kabhi 0/undefined => header status bar (time, network, battery) ke neeche chala jata tha.
//   - screens me 30+ jagah yahi value padhi jati hai.
// Isliye yahan EK jagah StatusBar.currentHeight ko asli window inset (safe-area-context) se badal dete hain.
// Yeh file src/index.js me sabse PEHLE import honi chahiye (StyleSheet.create module load par value padhta hai).
import { Platform, StatusBar } from 'react-native';
import { initialWindowMetrics } from 'react-native-safe-area-context';

if (Platform.OS === 'android') {
    try {
        const real = Math.round(initialWindowMetrics?.insets?.top ?? 0);
        const resource = Number(StatusBar.currentHeight) || 0;
        const best = Math.max(real, resource);
        if (best > 0 && best !== StatusBar.currentHeight) {
            Object.defineProperty(StatusBar, 'currentHeight', { value: best, writable: true, configurable: true });
        }
    } catch (e) {
        // original value hi rahe
    }
}
