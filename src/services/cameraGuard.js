import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import callService from './callService';
import { getActiveCall } from './activeCallStore';

// Camera app me kahin bhi khule (chat, status, profile, group, channel...) — pehle yeh check:
//  * Chalti call nahi hai par Agora engine zinda hai (call ke baad release na hua) → engine release, camera free.
//  * Call chal rahi hai → camera uska hai; user ko batao (do jagah ek hi camera nahi chal sakta, black screen aati hai).
export const ensureCameraFree = () => {
    if (getActiveCall()) return false;
    try { callService.release(); } catch (e) { /* engine tha hi nahi */ }
    return true;
};

export const launchCameraAsync = async (options) => {
    if (!ensureCameraFree()) {
        Alert.alert('Camera in use', 'Your call is using the camera. End the call to take a photo or video.');
        return { canceled: true, assets: null };
    }
    return ImagePicker.launchCameraAsync(options);
};
