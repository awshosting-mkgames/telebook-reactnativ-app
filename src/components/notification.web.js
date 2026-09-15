// Web no-op notification service. Metro picks this file over notification.js for the web bundle.
//
// Push notifications is project ke liye Android-only hain. @react-native-firebase v24 ka koi web
// build hai hi nahi (package mein ek bhi .web.js file nahi), isliye web par getApps() hamesha
// khali rehta tha aur har app load par "Firebase messaging not initialized" log hota tha — saath
// hi browser ka notification-permission prompt bhi bina kisi wajah ke aata tha.
//
// Yahan har export wahi signature rakhta hai jo notification.js deta hai, bas kuch karta nahi.
// Agar kabhi web push chahiye hoga to Firebase JS SDK ka setup isi file mein aayega; tab tak
// Android ka code (notification.js) chhedne ki zaroorat nahi.

const noop = () => {};

export async function setupAndroidChannel() {}

export async function requestExpoNotificationPermission() {
    return false;
}

export async function requestAndroidNotificationPermission() {
    return false;
}

export async function generateAndSaveFCMToken() {
    return null;
}

export function setupTokenRefreshListener() {
    return noop;
}

export function setupForegroundHandler() {
    return noop;
}

export function setupBackgroundHandler() {}

export function setupNotificationClickHandlers() {
    return noop;
}

// notification.js bhi kuch store na hone par null deta hai, to login flow ke liye same shape.
export async function getStoredToken() {
    return null;
}
