import { useEffect } from 'react';
import { AppState } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { updateChatLastMessage } from '../redex/slices/chatListSlice';
import { persistChatTabs, processChat, syncAllTabData } from '../services/chatSync';
import socketService from '../services/socketService';

// Chat list ka socket listener app ke root par (src/index.js), kisi screen par nahi.
// Pehle ye Freechat screen me tha — Chats tab mount na ho (lazy tab) to list update
// nahi hoti thi, aur Freechat do jagah khul jaye to sab do baar chalta tha.
//
//   message-received → turant Redux (last message + unread + top) → 1.5s baad
//                      background me 4-tab API sync (burst me ek hi sync)
//   group events     → sirf background sync
//   app active       → background sync (background me socket band tha)
const ChatListSocketSync = () => {
    const dispatch = useDispatch();
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
            dispatch(updateChatLastMessage({ msg, myUserId, chat: fallbackChat }));
            dispatch(persistChatTabs());
            scheduleBackgroundSync();
        };

        const GROUP_EVENTS = ['added-to-group', 'removed-from-group', 'group-updated'];

        socketService.on('message-received', handleNewMessage);
        GROUP_EVENTS.forEach((event) => socketService.on(event, scheduleBackgroundSync));

        const appStateSub = AppState.addEventListener('change', (next) => {
            if (next === 'active') scheduleBackgroundSync();
        });

        return () => {
            if (timer) clearTimeout(timer);
            appStateSub.remove();
            socketService.off('message-received', handleNewMessage);
            GROUP_EVENTS.forEach((event) => socketService.off(event, scheduleBackgroundSync));
        };
    }, [myUserId, token, dispatch]);

    return null;
};

export default ChatListSocketSync;
