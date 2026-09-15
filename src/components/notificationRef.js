// ─────────────────────────────────────────────
//  notificationService.js
//  Complete FCM + Expo Notifications service
//  Handles: Foreground | Background | Killed
//  + Type-based navigation
// ─────────────────────────────────────────────

import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApps } from '@react-native-firebase/app';
import messaging from '@react-native-firebase/messaging';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { getRouteConfig } from './notificationConfig';

// ─── Constants ────────────────────────────────
const TOKEN_KEY = 'FCM_TOKEN';

// ─── Android Channel (REQUIRED for Android 8+) ──
const ANDROID_CHANNEL = {
  id: 'default_channel',
  name: 'General Notifications',
  importance: Notifications.AndroidImportance.HIGH,
  vibrationPattern: [0, 250, 250, 250],
  lightColor: '#6C63FF',
  sound: 'default',
  enableVibrate: true,
};

// ─── Notification Handler ─────────────────────
// Foreground mein popup show karo
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// ─── Android Channel Setup ────────────────────
export async function setupAndroidChannel() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(
      ANDROID_CHANNEL.id,
      {
        name: ANDROID_CHANNEL.name,
        importance: ANDROID_CHANNEL.importance,
        vibrationPattern: ANDROID_CHANNEL.vibrationPattern,
        lightColor: ANDROID_CHANNEL.lightColor,
        sound: ANDROID_CHANNEL.sound,
        enableVibrate: ANDROID_CHANNEL.enableVibrate,
      }
    );
  }
}

// ─── Firebase Safe Instance ───────────────────
function getMessagingSafe() {
  if (getApps().length === 0) {
    console.warn('⚠️ Firebase not initialized yet');
    return null;
  }
  return messaging();
}

// ─── Token: Get Stored ────────────────────────
export async function getStoredToken() {
  try {
    return await AsyncStorage.getItem(TOKEN_KEY);
  } catch (e) {
    console.error('❌ getStoredToken error:', e);
    return null;
  }
}

// ─── Token: Generate & Save ───────────────────
export async function generateAndSaveFCMToken() {
  try {
    const msg = getMessagingSafe();
    if (!msg) return null;

    // iOS → permission maango
    const authStatus = await msg.requestPermission();
    const isAuthorized =
      authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
      authStatus === messaging.AuthorizationStatus.PROVISIONAL;

    if (!isAuthorized && Platform.OS === 'ios') {
      console.warn('⚠️ iOS notification permission denied');
      return null;
    }

    const token = await msg.getToken();
    await AsyncStorage.setItem(TOKEN_KEY, token);
    console.log('🔥 FCM Token saved:', token);
    return token;
  } catch (e) {
    console.error('❌ generateAndSaveFCMToken error:', e);
    return null;
  }
}

// ─── Token: Refresh Listener ──────────────────
export function setupTokenRefreshListener(onNewToken) {
  const msg = getMessagingSafe();
  if (!msg) return () => {};

  return msg.onTokenRefresh(async (newToken) => {
    console.log('🔄 FCM Token refreshed:', newToken);
    await AsyncStorage.setItem(TOKEN_KEY, newToken);
    onNewToken?.(newToken); // backend ko bhejo
  });
}

// ─── Build Local Notification ─────────────────
// FCM message → Expo local notification (foreground)
async function showLocalNotification(remoteMessage) {
  const { notification = {}, data = {} } = remoteMessage;
  const type   = data?.type ?? 'default';
  const config = getRouteConfig(type);

  await Notifications.scheduleNotificationAsync({
    content: {
      title: notification.title ?? data?.title ?? 'New Notification',
      body:  notification.body  ?? data?.body  ?? '',
      data:  {
        // Navigation ke liye zaroori fields
        type,
        ...data,
        // iOS-compatible structured params
        _params: JSON.stringify(config.getParams(data)),
        _screen: config.screen,
      },
      sound: 'default',
      // Android: channel se high-priority popup milti hai
      ...(Platform.OS === 'android' && {
        android: { channelId: ANDROID_CHANNEL.id },
      }),
    },
    trigger: null, // turant dikhao
  });
}

// ─── Foreground Handler ───────────────────────
// App OPEN hai aur notification aaye
export function setupForegroundHandler() {
  const msg = getMessagingSafe();
  if (!msg) return () => {};

  const unsubscribe = msg.onMessage(async (remoteMessage) => {
    console.log('📩 Foreground FCM:', remoteMessage);
    await showLocalNotification(remoteMessage);
  });

  return unsubscribe; // cleanup ke liye return karo
}

// ─── Background Handler ───────────────────────
// App BACKGROUND mein hai  (index.js / App.js ke TOP LEVEL pe call karo)
export function setupBackgroundHandler() {
  messaging().setBackgroundMessageHandler(async (remoteMessage) => {
    console.log('🌙 Background FCM:', remoteMessage);
    // FCM automatically system tray mein dikhata hai
    // Custom processing here (badge update, local DB, etc.)
  });
}

// ─── Core Navigation Handler ──────────────────
function navigateTo(data, navigation) {
  try {
    if (!navigation || !data) return;

    const type   = data?.type ?? 'default';
    const config = getRouteConfig(type);
    const screen = data?._screen ?? config.screen;

    // Params: pehle _params check karo (local notifications ka), phir fresh calculate
    let params = {};
    if (data?._params) {
      try { params = JSON.parse(data._params); } catch (_) {}
    } else {
      params = config.getParams(data);
    }

    console.log(`👉 Navigate → ${screen}`, params);
    navigation.navigate(screen, params);
  } catch (e) {
    console.error('❌ navigateTo error:', e);
  }
}

// ─── All Notification Click Handlers ─────────
/**
 * Ek hi jagah se saare click handlers setup karo
 * navigation → React Navigation ka navigation object
 * Returns cleanup function
 */
export function setupNotificationClickHandlers(navigation) {
  const msg = getMessagingSafe();
  if (!msg) return () => {};

  // ── 1. KILLED STATE ──
  // App band thi, notification click se khuli
  msg.getInitialNotification().then((remoteMessage) => {
    if (remoteMessage) {
      console.log('💀 Killed state click:', remoteMessage);
      navigateTo(remoteMessage.data, navigation);
    }
  });

  // ── 2. BACKGROUND STATE ──
  // App background mein thi, notification click se foreground aayi
  const unsubBackground = msg.onNotificationOpenedApp((remoteMessage) => {
    if (remoteMessage) {
      console.log('🌙 Background click:', remoteMessage);
      navigateTo(remoteMessage.data, navigation);
    }
  });

  // ── 3. FOREGROUND STATE ──
  // Local notification (from showLocalNotification) click
  const unsubForeground = Notifications.addNotificationResponseReceivedListener(
    (response) => {
      console.log('📩 Foreground notification click:', response);
      const data = response.notification.request.content.data;
      navigateTo(data, navigation);
    }
  );

  // Cleanup function return karo
  return () => {
    unsubBackground?.();
    unsubForeground?.remove();
  };
}

// ─── Badge Count ──────────────────────────────
export async function setBadgeCount(count) {
  try {
    await Notifications.setBadgeCountAsync(count);
  } catch (e) {
    console.warn('Badge update failed:', e);
  }
}

export async function clearBadge() {
  await setBadgeCount(0);
}

// ─── Master Init ──────────────────────────────
/**
 * App start pe ek baar call karo (App.js ya index.js mein)
 * navigation → useNavigation() ya navigationRef
 * onTokenReceived → backend ko token bhejne ka callback
 */
export async function initNotifications({ navigation, onTokenReceived } = {}) {
  // Step 1: Android channel
  await setupAndroidChannel();

  // Step 2: Token generate/save
  const token = await generateAndSaveFCMToken();
  if (token) onTokenReceived?.(token);

  // Step 3: Token refresh listener
  setupTokenRefreshListener(onTokenReceived);

  // Step 4: Foreground message handler
  const unsubForeground = setupForegroundHandler();

  // Step 5: Click handlers (navigation ke saath)
  const unsubClicks = navigation
    ? setupNotificationClickHandlers(navigation)
    : () => {};

  console.log('✅ Notification service initialized');

  // Return cleanup
  return () => {
    unsubForeground();
    unsubClicks();
  };
}
