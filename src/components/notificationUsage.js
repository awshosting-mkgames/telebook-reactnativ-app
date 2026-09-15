// ═══════════════════════════════════════════════════════
//  USAGE GUIDE — Notification Service Integration
// ═══════════════════════════════════════════════════════

// ─────────────────────────────────────────────
//  1. index.js  (ya App entry point)
//  Background handler MUST be TOP LEVEL register
// ─────────────────────────────────────────────
/*
import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';
import { setupBackgroundHandler } from './notificationService';

setupBackgroundHandler(); // ← Sabse pehle, top level

AppRegistry.registerComponent(appName, () => App);
*/


// ─────────────────────────────────────────────
//  2. App.js  (NavigationContainer ke saath)
// ─────────────────────────────────────────────
/*
import React, { useEffect, useRef } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { navigationRef } from './navigationRef';       // optional global ref
import { initNotifications } from './notificationService';
import { saveTokenToBackend } from './api';            // apna API call

export default function App() {
  const navRef = useRef(null);

  useEffect(() => {
    let cleanup;

    // navigationRef ready hone tak ek tick wait karo
    const timer = setTimeout(async () => {
      cleanup = await initNotifications({
        navigation: navRef.current,
        onTokenReceived: saveTokenToBackend,
      });
    }, 500);

    return () => {
      clearTimeout(timer);
      cleanup?.();
    };
  }, []);

  return (
    <NavigationContainer ref={navRef}>
      <YourNavigator />
    </NavigationContainer>
  );
}
*/


// ─────────────────────────────────────────────
//  3. Backend se notification bhejne ka format
//  FCM payload example (Node.js / REST)
// ─────────────────────────────────────────────
/*
const message = {
  token: 'USER_FCM_TOKEN',

  notification: {
    title: 'Order Shipped! 🚀',
    body: 'Your order #1234 is on the way.',
  },

  data: {
    // ← YEH IMPORTANT HAI — type ZAROORI hai
    type:        'order_shipped',
    order_id:    '1234',
    tracking_id: 'TRK999',
  },

  android: {
    priority: 'high',
    notification: {
      channelId: 'default_channel',   // Android channel se match karna chahiye
      sound: 'default',
    },
  },

  apns: {
    payload: {
      aps: {
        sound: 'default',
        badge: 1,
      },
    },
  },
};
*/


// ─────────────────────────────────────────────
//  4. Type → Screen mapping quick reference
// ─────────────────────────────────────────────
/*
  type                screen           params passed
  ─────────────────── ──────────────── ──────────────────────
  order_placed      → OrderDetail      { orderId }
  order_shipped     → TrackOrder       { orderId, trackingId }
  order_delivered   → OrderDetail      { orderId }
  order_cancelled   → OrderDetail      { orderId }
  new_message       → ChatScreen       { chatId, userId }
  new_follower      → UserProfile      { userId }
  post_liked        → PostDetail       { postId }
  comment           → PostDetail       { postId, focusComment }
  payment_success   → PaymentSummary   { paymentId }
  payment_failed    → PaymentSummary   { paymentId }
  refund            → PaymentSummary   { paymentId }
  promo             → PromoScreen      { promoId }
  alert             → AlertScreen      { alertId }
  default           → HomeScreen       {}

  Naya type add karna: notificationConfig.js mein NOTIFICATION_TYPES
  aur NOTIFICATION_ROUTE_MAP mein ek entry add karo.
*/


// ─────────────────────────────────────────────
//  5. Screen pe params receive karna
// ─────────────────────────────────────────────
/*
// OrderDetail.js
import React, { useEffect } from 'react';

export default function OrderDetail({ route }) {
  const { orderId } = route.params ?? {};

  useEffect(() => {
    if (orderId) fetchOrder(orderId);
  }, [orderId]);

  return <View>...</View>;
}
*/


// ─────────────────────────────────────────────
//  6. Notification States — Summary
// ─────────────────────────────────────────────
/*
  State       FCM Delivers?   Popup?              Click Handler
  ─────────── ─────────────── ─────────────────── ──────────────────────────
  FOREGROUND  ✅ onMessage()  ✅ scheduleNotif()  addNotificationResponseReceivedListener
  BACKGROUND  ✅ auto system  ✅ OS shows it      onNotificationOpenedApp()
  KILLED      ✅ auto system  ✅ OS shows it      getInitialNotification()
*/
