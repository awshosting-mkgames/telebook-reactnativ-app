import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApps } from '@react-native-firebase/app';
import messaging from '@react-native-firebase/messaging';
import * as Notifications from 'expo-notifications';
import notifee, { AndroidCategory, AndroidImportance, AndroidVisibility, EventType } from '@notifee/react-native';
import {
    PermissionsAndroid,
    Platform,
} from 'react-native';

import { navigate } from '../navigation/RootNavigation';
import { getRouteConfig } from './notificationConfig';
import { rejectCall } from '../services/callHelpers';
import apiService from '../services/apiService';
import { getDeviceId } from '../services/deviceId';
import { getData } from '../services/staticStorage';
import Config from '../services/config';

const TOKEN_KEY = 'FCM_TOKEN';
const ANDROID_CHANNEL_ID = 'default_channel';
// Alag channel — regular message notifications se importance/sound/vibration
// alag honi chahiye (ringtone jaisa), aur channel settings pehli baar banne
// ke baad badal nahi sakti isliye shuru se hi apna id.
// v2: purane 'incoming_calls' channel ki sound (default notification tune) badal nahi sakti — naya id.
const CALL_CHANNEL_ID = 'incoming_calls_v2';
const OLD_CALL_CHANNEL_ID = 'incoming_calls';

// Part1 #16 — sound/vibration user setting ke hisaab se alag channels. Android
// mein channel ki sound/vibration banne ke baad badal nahi sakti, isliye har
// combination ka apna NAYA id hai aur setting dekh kar channel chunte hain.
const MSG_CHANNELS = {
    both: 'msgs_default', // sound + vibration
    soundOnly: 'msgs_sound',
    vibrateOnly: 'msgs_vibrate',
    silent: 'msgs_silent',
};

// Redux store se user ki notificationSettings (lazy require: import cycle se bachne ke liye).
// Background/headless context mein store khali ho sakta hai — tab default (sound+vibration on).
function getNotifSettings() {
    try {
        // eslint-disable-next-line global-require
        const { store } = require('../redex/store');
        return store.getState()?.totalappData?.user?.notificationSettings || {};
    } catch (e) {
        return {};
    }
}

function pickMessageChannel(ns = {}) {
    const sound = ns.sound !== false;
    const vibration = ns.vibration !== false;
    if (sound && vibration) return MSG_CHANNELS.both;
    if (sound) return MSG_CHANNELS.soundOnly;
    if (vibration) return MSG_CHANNELS.vibrateOnly;
    return MSG_CHANNELS.silent;
}

Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: getNotifSettings().sound !== false,
        shouldSetBadge: true,
    }),
});

function getMessagingSafe() {
    if (getApps().length === 0) return null;
    return messaging();
}


export async function setupAndroidChannel() {
    if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync(
            ANDROID_CHANNEL_ID,
            {
                name: 'General Notifications',
                importance: Notifications.AndroidImportance.HIGH,
                vibrationPattern: [0, 250, 250, 250],
                lightColor: '#6C63FF',
                // `sound` key jaan-boojh kar nahi di ja rahi: channel options mein
                // string ko custom sound ka FILENAME maana jata hai (koi 'default'
                // sentinel nahi hota), aur file na milne par expo error log karta hai.
                // Key hatane par Android khud DEFAULT_NOTIFICATION_URI use karta hai.
                enableVibrate: true,
                lockscreenVisibility:
                    Notifications.AndroidNotificationVisibility.PUBLIC,
            }
        );

        // Setting-based message channels (default_channel legacy ke liye jaisa tha waisa hi).
        // `sound` key sirf silent variants mein null; baaki mein key hatane par system default sound.
        const base = {
            importance: Notifications.AndroidImportance.HIGH,
            lightColor: '#6C63FF',
            lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        };
        const defs = [
            { id: MSG_CHANNELS.both, name: 'Messages', opts: { vibrationPattern: [0, 250, 250, 250], enableVibrate: true } },
            { id: MSG_CHANNELS.soundOnly, name: 'Messages (no vibration)', opts: { enableVibrate: false } },
            { id: MSG_CHANNELS.vibrateOnly, name: 'Messages (vibrate only)', opts: { sound: null, vibrationPattern: [0, 250, 250, 250], enableVibrate: true } },
            { id: MSG_CHANNELS.silent, name: 'Messages (silent)', opts: { sound: null, enableVibrate: false } },
        ];
        for (const d of defs) {
            try {
                await Notifications.setNotificationChannelAsync(d.id, { name: d.name, ...base, ...d.opts });
            } catch (e) {
                console.log('❌ message channel error:', d.id, e?.message);
            }
        }
    }
}

// WhatsApp jaisa full-screen incoming-call notification (locked phone / app
// killed par bhi ringing screen) — notifee ka alag channel, zyada importance
// aur apna sound/vibration pattern taaki chat-message notification se alag dikhe.
export async function setupCallChannel() {
    if (Platform.OS !== 'android') return;
    try {
        try { await notifee.deleteChannel(OLD_CALL_CHANNEL_ID); } catch (e) { /* pehle se nahi hai */ }
        await notifee.createChannel({
            id: CALL_CHANNEL_ID,
            name: 'Incoming calls',
            importance: AndroidImportance.HIGH,
            // res/raw/ringtone.wav (expo-notifications plugin `sounds` se copy hota hai) — in-app
            // ringtone (assets/sounds/ringtone.wav) jaisi hi, taaki dono jagah ek hi tune baje.
            sound: 'ringtone',
            vibration: true,
            // notifee reject karta hai agar pattern ka pehla value 0/non-positive ho;
            // in-app vibration (ringtoneModule CALL_VIBE_PATTERN: 0.8s buzz / 1.2s pause) jaisa hi
            // pattern, bas shuru me 1ms.
            vibrationPattern: [1, 800, 1200, 800, 1200, 800, 1200, 800, 1200, 800, 1200, 800, 1200],
            visibility: AndroidVisibility.PUBLIC,
        });
    } catch (e) {
        console.log('❌ setupCallChannel error:', e);
    }
}

// FCM data message {entity:'call', entityId, callType, callerName, callerPhoto}
// se full-screen notification banata hai. App backgrounded/killed dono mein
// yahi chalta hai — foreground mein socket (IncomingCallManager) ring overlay
// dikhata hai, isliye wahan yeh dobara nahi bulaya jaata.
export async function displayIncomingCallNotification(data = {}) {
    const callId = data.entityId;
    if (!callId) return;
    const callType = data.callType === 'video' ? 'video' : 'audio';
    // `callerPhoto` server se raw storage key (`uploads/...`) aati hai, poora
    // URL nahi — aur jab photo hi nahi hoti to key `undefined` ke saath set
    // rehti thi (notifee is par validation error deta hai: largeIcon ya to
    // poora string URL/ImageResource hona chahiye ya key hi na ho). Isliye
    // ab sirf tabhi largeIcon bhejte hain jab photo waqai maujood ho, aur
    // usse poora URL bana ke.
    const photoUrl = data.callerPhoto
        ? (/^(https?:|file:|content:)/.test(data.callerPhoto) ? data.callerPhoto : `${Config.MEDIA_URL}${data.callerPhoto}`)
        : null;
    try {
        await notifee.displayNotification({
            id: `call_${callId}`,
            title: data.callerName || 'Incoming call',
            body: callType === 'video' ? 'Incoming video call' : 'Incoming voice call',
            data: { entity: 'call', entityId: callId, callType },
            android: {
                channelId: CALL_CHANNEL_ID,
                category: AndroidCategory.CALL,
                importance: AndroidImportance.HIGH,
                visibility: AndroidVisibility.PUBLIC,
                ongoing: true,
                autoCancel: false,
                loopSound: true,
                lightUpScreen: true,
                smallIcon: 'ic_launcher',
                ...(photoUrl ? { largeIcon: photoUrl } : {}),
                // Locked device: poori screen par ring UI khud khul jaaye.
                fullScreenAction: { id: 'default' },
                // Notification shade/heads-up se bhi seedha accept/decline.
                pressAction: { id: 'default' },
                actions: [
                    { title: 'Decline', pressAction: { id: 'decline' } },
                    { title: 'Accept', pressAction: { id: 'accept', launchActivity: 'default' } },
                ],
            },
        });
    } catch (e) {
        console.log('❌ displayIncomingCallNotification error:', e);
    }
}

export async function cancelIncomingCallNotification(callId) {
    if (!callId) return;
    try {
        await notifee.cancelNotification(`call_${callId}`);
    } catch (e) {
        // notification already gone — safe to ignore
    }
}

// Decline ko app kholne ki zarurat nahi — seedha reject API call karke
// notification hata do. Accept/body-tap InCallScreen par le jaate hain
// (autoAccept sirf jab explicit "Accept" button dabaya ho).
async function handleCallNotificationEvent({ type, detail }) {
    const notification = detail?.notification;
    const callId = notification?.data?.entityId;
    if (!callId) return;
    const pressActionId = detail?.pressAction?.id;

    if (type === EventType.ACTION_PRESS && pressActionId === 'decline') {
        rejectCall(callId);
        await cancelIncomingCallNotification(callId);
        return;
    }

    if (type === EventType.PRESS || (type === EventType.ACTION_PRESS && pressActionId === 'accept')) {
        await cancelIncomingCallNotification(callId);
        navigate('InCall', {
            callId,
            type: notification?.data?.callType,
            isIncoming: true,
            autoAccept: pressActionId === 'accept',
        });
    }
}

// App start se pehle (index.js top-level) register karna zaroori hai — tabhi
// app killed state mein bhi "Decline" background event handle ho paata hai.
export function registerCallBackgroundEvents() {
    notifee.onBackgroundEvent(handleCallNotificationEvent);
}

// App open hone ke baad (foreground event + cold-start initial notification).
export function setupCallForegroundHandlers() {
    const unsub = notifee.onForegroundEvent(({ type, detail }) => {
        handleCallNotificationEvent({ type, detail });
    });

    notifee.getInitialNotification().then((initial) => {
        if (!initial) return;
        handleCallNotificationEvent({ type: EventType.PRESS, detail: { notification: initial.notification, pressAction: initial.pressAction } });
    });

    return unsub;
}

export async function requestExpoNotificationPermission() {
    try {
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        if (existingStatus === 'granted') {
            return true;
        }
        const { status } = await Notifications.requestPermissionsAsync();
        return status === 'granted';
    } catch (error) {
        console.log(
            '❌ Expo notification permission error:',
            error
        );
        return false;
    }
}

export async function requestAndroidNotificationPermission() {
    try {
        if (
            Platform.OS === 'android' &&
            Platform.Version >= 33
        ) {
            const granted = await PermissionsAndroid.request(
                PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
            );
            return (
                granted === PermissionsAndroid.RESULTS.GRANTED
            );
        }
        return true;
    } catch (error) {
        console.log(
            '❌ Android notification permission error:',
            error
        );
        return false;
    }
}


export async function generateAndSaveFCMToken() {
    try {
        const androidGranted = await requestAndroidNotificationPermission();

        if (!androidGranted) {
            console.log(
                '❌ Android notification permission denied'
            );
            return null;
        }
        const expoGranted =
            await requestExpoNotificationPermission();

        if (!expoGranted) {
            console.log(
                '❌ Expo notification permission denied'
            );
            return null;
        }
        const msg = getMessagingSafe();
        if (!msg) {
            console.log('❌ Firebase messaging not initialized');
            return null;
        }
        const authStatus = await msg.requestPermission();
        const isAuthorized =
            authStatus ===
                messaging.AuthorizationStatus.AUTHORIZED ||
            authStatus ===
                messaging.AuthorizationStatus.PROVISIONAL;

        if (!isAuthorized) {
            console.log('❌ FCM permission denied');
            return null;
        }

        const token = await msg.getToken();
        if (!token) {
            console.log('❌ Failed to get FCM token');
            return null;
        }
        await AsyncStorage.setItem(TOKEN_KEY, token);

        return token;
    } catch (e) {
        console.error('❌ generateAndSaveFCMToken:', e);
        return null;
    }
}

// Login ke baad ye hi endpoint token backend par (re)save karta hai — API doc
// section 8, rule 3: "Send it again on every app start while logged in, and
// whenever it changes." Yeh rule pehle poori tarah miss tha: na app-start par
// dobara bheja ja raha tha, na refresh par — sirf login (verify-otp) ke waqt
// ek baar. Reinstall / cleared data / backup-restore ke baad Firebase naya
// token deta hai jiska koi refresh event bhi nahi aata — isliye app-start
// wala call zaroori hai, sirf refresh listener kaafi nahi.
export async function syncPushToken() {
    try {
        // Logged-in hi nahi hai to save-token call karne ka koi matlab nahi
        // (apiService token na mile to Authorization header hi nahi bhejega,
        // aur backend route private hai — 401 hi aata).
        const authToken = await getData('token');
        if (!authToken) return;

        const msg = getMessagingSafe();
        if (!msg) return;
        const token = await msg.getToken();
        if (!token) return;
        await AsyncStorage.setItem(TOKEN_KEY, token);
        const deviceId = await getDeviceId();
        await apiService({
            method: 'POST',
            endpoint: 'notifications/save-token',
            data: { token, deviceType: 'android', deviceId },
        });
    } catch (e) {
        console.log('❌ syncPushToken error:', e);
    }
}

/**
 * Token refresh listener — refresh hote hi naya token backend ko bhi bhejta
 * hai (pehle sirf AsyncStorage me save hota tha, backend ko kabhi nahi).
 */
export function setupTokenRefreshListener(onNewToken) {
    const msg = getMessagingSafe();

    if (!msg) return () => {};

    return msg.onTokenRefresh(async (newToken) => {
        console.log('🔄 New FCM Token:', newToken);

        await AsyncStorage.setItem(
            TOKEN_KEY,
            newToken
        );

        try {
            const authToken = await getData('token');
            if (authToken) {
                const deviceId = await getDeviceId();
                await apiService({
                    method: 'POST',
                    endpoint: 'notifications/save-token',
                    data: { token: newToken, deviceType: 'android', deviceId },
                });
            }
        } catch (e) {
            console.log('❌ token-refresh save-token error:', e);
        }

        onNewToken?.(newToken);
    });
}

/**
 * Show local notification
 */
async function showLocalNotification(remoteMessage) {
    try {
        const { notification = {}, data = {} } =
            remoteMessage;

        const config = getRouteConfig(data);
        const ns = getNotifSettings();

        await Notifications.scheduleNotificationAsync({
            content: {
                title:
                    notification.title ??
                    data?.title ??
                    'New Notification',

                body:
                    notification.body ??
                    data?.body ??
                    '',

                // Part1 #16 — user ne sound band ki to null; vibration band ho to khaali pattern.
                sound: ns.sound === false ? null : 'default',
                ...(ns.vibration === false ? { vibrate: [] } : {}),

                data: {
                    ...data,
                    _screen: config.screen,
                    _params: JSON.stringify(
                        config.getParams(data)
                    ),
                },
            },

            trigger:
                Platform.OS === 'android'
                    ? {
                          type: 'channel',
                          channelId: pickMessageChannel(ns),
                      }
                    : null,
        });
    } catch (error) {
        console.log(
            '❌ showLocalNotification error:',
            error
        );
    }
}

/**
 * Foreground notifications
 */
export function setupForegroundHandler() {
    const msg = getMessagingSafe();

    if (!msg) return () => {};

    return msg.onMessage(async (remoteMessage) => {
        console.log(
            '📩 Foreground FCM:',
            JSON.stringify(remoteMessage, null, 2)
        );

        // App foreground mein hai — socket (IncomingCallManager) ring overlay
        // khud dikha deta hai, yahan dobara notification nahi dikhani.
        if (remoteMessage?.data?.entity === 'call') return;

        await showLocalNotification(remoteMessage);
    });
}

/**
 * Background notifications
 */
export function setupBackgroundHandler() {
    const msg = getMessagingSafe();

    if (!msg) return;

    msg.setBackgroundMessageHandler(
        async (remoteMessage) => {
            console.log(
                '🌙 Background FCM:',
                JSON.stringify(remoteMessage, null, 2)
            );

            // App background/killed — yahi se WhatsApp jaisa full-screen
            // ringing notification dikhana hai (socket yahan connected nahi
            // hota, isliye IncomingCallManager ka overlay yahan kaam nahi karega).
            //
            // `action` do tarah ki aati hai: "incoming" (naya call — dikhao)
            // aur "dismiss" (call cancel/reject/timeout ho gaya — jo already
            // dikhi hui notification hai use hatao). Pehle "dismiss" ko bhi
            // displayIncomingCallNotification() hi bula deta tha, jo galat
            // UI (ya crash — callerPhoto na hone par) deta tha.
            if (remoteMessage?.data?.entity === 'call') {
                if (remoteMessage.data.action === 'dismiss') {
                    await cancelIncomingCallNotification(remoteMessage.data.entityId);
                } else {
                    await displayIncomingCallNotification(remoteMessage.data);
                }
            }
        }
    );
}

/**
 * Navigation handler
 */
function handleNavigate(data) {
    try {
        if (!data) return;

        const config = getRouteConfig(data);

        const screen =
            data?._screen ?? config.screen;

        let params = {};

        if (data?._params) {
            try {
                params = JSON.parse(data._params);
            } catch (_) {}
        } else {
            params = config.getParams(data);
        }

        console.log(
            '👉 Navigate →',
            screen,
            params
        );

        navigate(screen, params);
    } catch (error) {
        console.log(
            '❌ Navigation error:',
            error
        );
    }
}

/**
 * Notification click listeners
 */
export function setupNotificationClickHandlers() {
    const msg = getMessagingSafe();

    if (!msg) return () => {};

    /**
     * App killed state
     */
    msg.getInitialNotification().then(
        (remoteMessage) => {
            if (remoteMessage) {
                console.log(
                    '🚀 App opened from quit state'
                );

                handleNavigate(remoteMessage.data);
            }
        }
    );

    /**
     * Background state
     */
    const unsubBackground =
        msg.onNotificationOpenedApp(
            (remoteMessage) => {
                console.log(
                    '📲 App opened from background'
                );

                if (remoteMessage) {
                    handleNavigate(remoteMessage.data);
                }
            }
        );

    /**
     * Foreground click
     */
    const unsubForeground =
        Notifications.addNotificationResponseReceivedListener(
            (response) => {
                console.log(
                    '👆 Foreground notification clicked'
                );

                handleNavigate(
                    response.notification.request.content.data
                );
            }
        );

    return () => {
        unsubBackground?.();
        unsubForeground?.remove();
    };
}

/**
 * Get stored token
 */
export async function getStoredToken() {
    try {
        return await AsyncStorage.getItem(TOKEN_KEY);
    } catch (e) {
        console.log('❌ getStoredToken error:', e);
        return null;
    }
}

// Logout (API doc section 8, rule 4): backend se token hatane ke baad
// Firebase ko bhi bata do ki yeh token ab is install ke kaam ka nahi —
// warna agli baar getToken() wahi purana token de sakta hai jab tak OS khud
// kabhi rotate na kare.
export async function clearPushToken() {
    try {
        const msg = getMessagingSafe();
        if (msg) await msg.deleteToken();
    } catch (e) {
        console.log('❌ clearPushToken error:', e);
    } finally {
        await AsyncStorage.removeItem(TOKEN_KEY);
    }
}