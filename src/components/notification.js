import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApps } from '@react-native-firebase/app';
import messaging from '@react-native-firebase/messaging';
import * as Notifications from 'expo-notifications';
import {
    PermissionsAndroid,
    Platform,
} from 'react-native';

import { navigate } from '../navigation/RootNavigation';
import { getRouteConfig } from './notificationConfig';

const TOKEN_KEY = 'FCM_TOKEN';
const ANDROID_CHANNEL_ID = 'default_channel';

Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
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
                sound: 'default',
                enableVibrate: true,
                lockscreenVisibility:
                    Notifications.AndroidNotificationVisibility.PUBLIC,
            }
        );
    }
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

/**
 * Token refresh listener
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

                sound: 'default',

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
                          channelId: ANDROID_CHANNEL_ID,
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