import { Alert, Linking } from 'react-native';
import Toast from 'react-native-toast-message';
import apiService from '../services/apiService';
import { store } from '../redex/store';
import { navigationRef } from './RootNavigation';

// Share links ka host — app.json ke intentFilters me bhi yahi host hai.
export const APP_LINK_HOST = 'telebook.app';
export const APP_LINK_SCHEME = 'telebook';

// Links: https://telebook.app/u/<code>, https://telebook.app/c/<slug>,
//        telebook://u/<code>, telebook://c/<slug>
const LINK_RE = /^(?:telebook:\/\/|https?:\/\/(?:www\.)?telebook\.app\/)(u|c)\/([^/?#\s]+)/i;

export const parseDeepLink = (url) => {
    const m = LINK_RE.exec(String(url || '').trim());
    if (!m) return null;
    return { type: m[1].toLowerCase(), value: decodeURIComponent(m[2]) };
};

const notAvailable = () =>
    Toast.show({ type: 'error', text1: 'This link is not available' });

// Login se pehle aaya link yahan rukta hai, login ke baad khulta hai
let pendingLink = null;
let busy = false;

const isLoggedIn = () => !!store.getState()?.totalappData?.isLogin;

const waitForNav = async (tries = 20) => {
    for (let i = 0; i < tries; i++) {
        if (navigationRef.isReady()) return true;
        await new Promise((r) => setTimeout(r, 300));
    }
    return false;
};

const openUserChat = async (code) => {
    const res = await apiService({ method: 'GET', endpoint: `users/invite/${encodeURIComponent(code)}` });
    const user = res?.data?.user;
    if (!res?.success || !user?._id) return notAvailable();

    const myId = store.getState()?.totalappData?.userId;
    if (user._id === myId) {
        Toast.show({ type: 'info', text1: 'This is your own link' });
        return;
    }
    // Contact screen jaisa hi flow: POST chats se 1-to-1 chat banao/kholo
    const chatRes = await apiService({ method: 'POST', endpoint: 'chats', data: { userId: user._id } });
    const chat = chatRes?.data?.chat;
    if (!chatRes?.success || !chat?._id) return notAvailable();
    const other = (chat.users || []).find((u) => u?._id !== myId) || user;
    navigationRef.navigate('Chat', {
        chatId: chat._id,
        chatName: other?.name || other?.mobile || user?.name || user?.mobile || 'User',
        chatImage: other?.profilePicture,
        isGroup: false,
        otherUserId: user._id,
    });
};

// Channel link silently join nahi karta: pehle user se poochte hain, haan par hi join + open.
// (Backend me slug se sirf-padhne wala endpoint nahi hai, join hi resolve karta hai.)
const openChannel = (slug) =>
    new Promise((resolve) => {
        Alert.alert('Open channel', 'Do you want to join this channel?', [
            { text: 'Cancel', style: 'cancel', onPress: () => resolve() },
            {
                text: 'Join',
                onPress: async () => {
                    const res = await apiService({ method: 'PUT', endpoint: `channels/join/${encodeURIComponent(slug)}` });
                    const channelId = res?.data?.channel?._id;
                    if (!res?.success || !channelId) notAvailable();
                    else navigationRef.navigate('Channeldetailscreen', { channelId });
                    resolve();
                },
            },
        ], { onDismiss: () => resolve() });
    });

export const handleDeepLink = async (url) => {
    const link = parseDeepLink(url);
    if (!link) return;
    if (!isLoggedIn()) {
        pendingLink = url;
        return;
    }
    if (busy) return;
    busy = true;
    try {
        if (!(await waitForNav())) return;
        if (link.type === 'u') await openUserChat(link.value);
        else await openChannel(link.value);
    } catch (e) {
        notAvailable();
    } finally {
        busy = false;
    }
};

/** Login ho jaane ke baad rukka hua link kholo */
export const flushPendingDeepLink = () => {
    if (!pendingLink || !isLoggedIn()) return;
    const url = pendingLink;
    pendingLink = null;
    // Main navigator mount hone ka thoda time do
    setTimeout(() => handleDeepLink(url), 800);
};

// NavigationContainer `linking` — React Navigation ko screens map nahi karne dete
// (links ko API se resolve karna padta hai), bas URL events hum handle karte hain.
export const linking = {
    prefixes: [`${APP_LINK_SCHEME}://`, `https://${APP_LINK_HOST}`, `https://www.${APP_LINK_HOST}`],
    getInitialURL: async () => {
        try {
            const url = await Linking.getInitialURL();
            if (url) handleDeepLink(url);
        } catch (e) { /* ignore */ }
        return null;
    },
    subscribe: () => {
        const sub = Linking.addEventListener('url', ({ url }) => handleDeepLink(url));
        return () => sub.remove();
    },
    getStateFromPath: () => undefined,
};
