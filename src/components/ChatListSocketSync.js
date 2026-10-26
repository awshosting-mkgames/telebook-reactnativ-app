import { useEffect } from 'react';
import { AppState } from 'react-native';
import { useDispatch, useSelector, useStore } from 'react-redux';
import { updateChatLastMessage } from '../redex/slices/chatListSlice';
import { persistChatTabs, processChat, syncAllTabData } from '../services/chatSync';
import socketService from '../services/socketService';

// Chat list ka socket listener app ke root par (src/index.js), kisi screen par nahi.
// Pehle ye Freechat screen me tha — Chats tab mount na ho (lazy tab) to list update
// nahi hoti thi, aur Freechat do jagah khul jaye to sab do baar chalta tha.
//
//   message-received → sirf Redux (last message + unread + top) + SQL persist.
//                      Koi API sync NAHI — har message par 4 API chalana band.
//                      Full sync tabhi jab chat list me nahi hai aur row local
//                      se ban nahi sakti (burst me ek hi sync).
//   group events     → background sync (membership server se hi aati hai)
//   app active       → background sync, par 30s ke andar dobara nahi (background
//                      me socket band tha, isliye ek baar catch-up zaroori hai)
const FOREGROUND_SYNC_GAP_MS = 30 * 1000;

const ChatListSocketSync = () => {
    const dispatch = useDispatch();
    const store = useStore();
    const myUserId = useSelector((state) => state.totalappData?.userId ?? null);
    const token = useSelector((state) => state.totalappData?.apiToken ?? null);

    useEffect(() => {
        if (!myUserId || !token) return undefined;

        let timer = null;
        const scheduleBackgroundSync = () => {
            if (timer) clearTimeout(timer);
            timer = setTimeout(() => {
                timer = null;
                syncAllTabData(dispatch, myUserId, { background: true });
            }, 1500);
        };

        const handleNewMessage = (msg) => {
            const incomingChatId = msg?.chat?._id ?? msg?.chat;
            if (!incomingChatId) return;
            // List me chat na ho (naya user / nayi chat) to message ke chat object
            // se hi row bana lo — background sync baad me poora data de dega.
            let fallbackChat = null;
            if (msg?.chat && typeof msg.chat === 'object') {
                const hasUserObjects = Array.isArray(msg.chat.users) && msg.chat.users.some((u) => u && typeof u === 'object');
                const users = hasUserObjects ? msg.chat.users : [msg.sender].filter((u) => u && typeof u === 'object');
                fallbackChat = processChat({ ...msg.chat, users }, myUserId);
            }
            const wasInList = (store.getState()?.chatList?.tabs?.All ?? []).some((c) => c._id === incomingChatId);
            dispatch(updateChatLastMessage({ msg, myUserId, chat: fallbackChat }));
            dispatch(persistChatTabs());
            // Known chat → local update kaafi hai. Naya chat bhi tab local ban sakta hai
            // jab fallback row me doosre user ka object ho; warna server se poori row lao.
            const canBuildLocally = !!fallbackChat && (fallbackChat.isGroupChat || !!fallbackChat.displayUser);
            if (!wasInList && !canBuildLocally) scheduleBackgroundSync();
        };

        const GROUP_EVENTS = ['added-to-group', 'removed-from-group', 'group-updated'];

        socketService.on('message-received', handleNewMessage);
        GROUP_EVENTS.forEach((event) => socketService.on(event, scheduleBackgroundSync));

        const appStateSub = AppState.addEventListener('change', (next) => {
            if (next !== 'active') return;
            const last = store.getState()?.chatList?.lastSyncedAt ?? 0;
            if (Date.now() - last > FOREGROUND_SYNC_GAP_MS) scheduleBackgroundSync();
        });

        return () => {
            if (timer) clearTimeout(timer);
            appStateSub.remove();
            socketService.off('message-received', handleNewMessage);
            GROUP_EVENTS.forEach((event) => socketService.off(event, scheduleBackgroundSync));
        };
    }, [myUserId, token, dispatch, store]);

    return null;
};

export default ChatListSocketSync;
