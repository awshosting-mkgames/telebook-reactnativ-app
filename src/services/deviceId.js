import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Server ko device-level FCM-token tracking ke liye stable id chahiye (API
// doc section 8: "deviceId must be stable for the install"). Koi
// react-native-device-info jaisi library install nahi hai, isliye install
// ke pehli baar ek UUID-jaisa random id bana ke AsyncStorage me rakh dete
// hain — baar-baar wahi wapas milta hai.

const DEVICE_ID_KEY = 'DEVICE_ID';

const generateId = () =>
    'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });

let cached = null;

export const getDeviceId = async () => {
    if (cached) return cached;
    try {
        let id = await AsyncStorage.getItem(DEVICE_ID_KEY);
        if (!id) {
            id = generateId();
            await AsyncStorage.setItem(DEVICE_ID_KEY, id);
        }
        cached = id;
        return id;
    } catch (e) {
        console.log('⚠️ getDeviceId error:', e);
        return cached ?? generateId();
    }
};

// Linked Devices me asli device naam dikhane ke liye ("Redmi Note 12", "OnePlus 11")
export const getDeviceInfo = () => {
    try {
        const Device = require('expo-device');
        const Constants = require('expo-constants').default;
        const brand = Device.brand ? String(Device.brand) : '';
        const model = Device.modelName || Device.deviceName || '';
        const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
        const name = model
            ? (brand && !String(model).toLowerCase().startsWith(brand.toLowerCase()) ? `${cap(brand)} ${model}` : String(model))
            : (cap(brand) || Platform.OS);
        return {
            deviceName: name,
            osVersion: Device.osVersion ? `${Device.osName || Platform.OS} ${Device.osVersion}` : undefined,
            appVersion: Constants?.expoConfig?.version,
        };
    } catch (e) {
        return { deviceName: Platform.OS === 'ios' ? 'iPhone' : 'Android phone' };
    }
};
