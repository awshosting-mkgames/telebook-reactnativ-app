import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Provider, useDispatch, useSelector, useStore } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import Toast from 'react-native-toast-message';

import ChatListSocketSync from './components/ChatListSocketSync';
import StatusBarComponent from './components/StatusBarcom';
import { ThemeProvider } from './components/ThemeContext';
import AppNavigator from './navigation';
import { persistor, store } from './redex/store';
import socketService from './services/socketService';
import IncomingCallManager from './components/IncomingCallManager';
import CallConfigLoader from './components/CallConfigLoader';
import { contactSync, loadContactsFromDb } from './services/contactSync';
import { getLastSyncedAt } from './services/contactsDb';
import { initChatTabs } from './services/chatSync';
import { refreshMyProfile } from './services/profileSync';
import {
    generateAndSaveFCMToken,
    registerCallBackgroundEvents,
    setupAndroidChannel,
    setupBackgroundHandler,
    setupCallChannel,
    setupCallForegroundHandlers,
    setupForegroundHandler,
    setupNotificationClickHandlers,
    setupTokenRefreshListener,
    syncPushToken,
} from './components/notification';

setupBackgroundHandler();
// App start se pehle hi register — killed-state mein "Decline" tap ko
// handle karne ke liye yeh JS module load hote hi chalna zaroori hai.
registerCallBackgroundEvents();
// Channel bhi yahin bana do (sirf foreground useEffect ke bharose nahi) —
// warna agar app kabhi foreground khula hi na ho aur pehli hi "call" push
// killed-state me aa jaye, to displayIncomingCallNotification() ek aisa
// channel id use karega jo abhi tak exist hi nahi karta, aur Android
// notification silently drop kar deta hai (koi error bhi nahi dikhta).
setupCallChannel();

// App khulte hi SQL se contacts Redux me le aao. Normally ye sync nahi hai —
// na device contacts padhe jate hain, na koi API call hoti hai.
//
// Exception: SQL khali hai aur user logged in hai (jaise purane login ke baad
// app update hua, ya sync fail ho gaya tha) — tab ek baar contactSync chalti hai,
// warna contacts kahin nahi dikhte (Contacts tab, group/broadcast member select).
const CONTACT_SYNC_STALE_MS = 6 * 60 * 60 * 1000; // 6 ghante
const CONTACT_SYNC_MIN_GAP_MS = 5 * 60 * 1000;    // fail/denied par bar-bar try na ho

const ContactsLoader = () => {
    const dispatch = useDispatch();
    const store = useStore();
    const token = useSelector((state) => state.totalappData?.apiToken ?? null);
    const doneForToken = useRef(null);
    const lastAttemptAt = useRef(0);

    // Auto sync: sirf SQL khali ho ya last sync 6h se purana ho. Silent (permission popup nahi),
    // aur ek time par ek hi sync (state.contacts.syncing guard).
    const maybeAutoSync = useRef(null);
    maybeAutoSync.current = async (force = false) => {
        try {
            if (store.getState()?.contacts?.syncing) return;
            const now = Date.now();
            if (now - lastAttemptAt.current < CONTACT_SYNC_MIN_GAP_MS) return;
            const last = await getLastSyncedAt();
            const stale = !last || now - last > CONTACT_SYNC_STALE_MS;
            const empty = !(store.getState()?.contacts?.contacts?.length);
            if (!force && !stale && !empty) return;
            lastAttemptAt.current = now;
            await contactSync(dispatch, { silent: true });
        } catch (e) {
            // auto sync ka error user ko nahi dikhana
        }
    };

    useEffect(() => {
        if (!token) {
            doneForToken.current = null;
            loadContactsFromDb(dispatch);
            return;
        }
        if (doneForToken.current === token) return;
        doneForToken.current = token;

        (async () => {
            await loadContactsFromDb(dispatch);
            // SQL khali ho ya purana (>6h) — dono me sync
            maybeAutoSync.current();
        })();
    }, [token, dispatch]);

    // App resume (background → active) par staleness check + active rehte hue har 6h
    useEffect(() => {
        if (!token) return undefined;
        let prev = AppState.currentState;
        const sub = AppState.addEventListener('change', (next) => {
            if (prev.match(/inactive|background/) && next === 'active') maybeAutoSync.current();
            prev = next;
        });
        const timer = setInterval(() => {
            if (AppState.currentState === 'active') maybeAutoSync.current();
        }, CONTACT_SYNC_STALE_MS);
        return () => { sub.remove(); clearInterval(timer); };
    }, [token]);

    return null;
};

// Login ka user object adhoora hota hai (profilePicture/about nahi aate),
// isliye token milte hi poori profile laakar Redux me daal dete hain.
const ProfileLoader = () => {
    const dispatch = useDispatch();
    const token = useSelector((state) => state.totalappData?.apiToken ?? null);
    const doneForToken = useRef(null);

    useEffect(() => {
        if (!token) {
            doneForToken.current = null;
            return;
        }
        if (doneForToken.current === token) return;
        doneForToken.current = token;
        refreshMyProfile(dispatch);
    }, [token, dispatch]);

    return null;
};

// App open par sabse pehle SQL check. SQL me 4 tabs ka data hai to sirf
// SQL → Redux (koi API nahi); khali hai to ek baar syncAllTabData() chalti hai.
const ChatTabsLoader = () => {
    const dispatch = useDispatch();
    const userId = useSelector((state) => state.totalappData?.userId ?? null);
    const doneForUser = useRef(null);

    useEffect(() => {
        if (!userId) {
            doneForUser.current = null;
            return;
        }
        // Ek login ke liye ek hi baar — tab change ya re-render par nahi
        if (doneForUser.current === userId) return;
        doneForUser.current = userId;
        initChatTabs(dispatch, userId);
    }, [userId, dispatch]);

    return null;
};

const SocketManager = () => {
    const maniAllData = useSelector((state) => state.totalappData);
    const token  = maniAllData?.apiToken ?? null;
    const userId = maniAllData?.userId   ?? null;

    useEffect(() => {
        if (token && userId) {
            socketService.connect(token, userId);
        } else {
            socketService.disconnect();
        }
        return () => socketService.disconnect();
    }, [token, userId]);

    return null;
};

export default function App() {
    useEffect(() => {
        let cleanupForeground = () => {};
        let cleanupClicks     = () => {};
        let cleanupRefresh    = () => {};
        let cleanupCallEvents = () => {};

        async function init() {
            await setupAndroidChannel();
            await setupCallChannel();
            await generateAndSaveFCMToken();
            // API doc rule: "send it again on every app start while logged
            // in" — login (verify-otp) sirf pehli baar save karta hai; agar
            // app reinstall/cleared-data/backup-restore ho (session bachi
            // rahe par Firebase naya token de, jiska refresh event bhi nahi
            // aata), to yahi call backend ko taaza token deta hai.
            await syncPushToken();
            cleanupRefresh    = setupTokenRefreshListener(() => {});
            cleanupForeground = setupForegroundHandler();
            cleanupClicks     = setupNotificationClickHandlers();
            cleanupCallEvents = setupCallForegroundHandlers();
        }

        const timer = setTimeout(init, 300);

        return () => {
            clearTimeout(timer);
            cleanupForeground();
            cleanupClicks();
            cleanupRefresh();
            cleanupCallEvents();
        };
    }, []);

    return (
        <ThemeProvider>
            <Provider store={store}>
                <PersistGate loading={null} persistor={persistor}>
                    <SafeAreaProvider>
                        <StatusBarComponent />
                        <SocketManager />
                        <ChatListSocketSync />
                        <ProfileLoader />
                        <ContactsLoader />
                        <ChatTabsLoader />
                        <CallConfigLoader />
                        <IncomingCallManager />
                        <AppNavigator />
                        <Toast />
                    </SafeAreaProvider>
                </PersistGate>
            </Provider>
        </ThemeProvider>
    );
}
