import { createSlice } from '@reduxjs/toolkit';
import { CHAT_TABS } from '../../services/chatsDb';

// Redux me chaaron tabs ka current data rehta hai. Persistent copy SQL me hai
// (src/services/chatsDb.js), isliye ye slice redux-persist me nahi hai.
//
//   loading → sirf tab dikhta hai jab SQL se Redux me load ho raha ho, ya
//             SQL khali hone par pehli baar API se data aa raha ho.
//   syncing → manual "Sync Data" aur socket background sync ke liye.
//             Socket sync par loader NAHI dikhana, isliye ye alag flag hai.

const emptyTabs = () => {
    const tabs = {};
    CHAT_TABS.forEach((tab) => { tabs[tab] = []; });
    return tabs;
};

const initialState = {
    tabs: emptyTabs(),
    loading: false,
    syncing: false,
    lastSyncedAt: null,
    error: null,
    // Abhi kaunsi chat screen khuli hai — us chat ka unread nahi badhna chahiye
    activeChatId: null,
    // Jin users ko maine block kiya hai (GET /users/blocked). List aur chat
    // screen dono isi se Block / Unblock dikhate hain.
    blockedIds: [],
};

// Har tab me jahan ye chat hai, wahan update kar do
const forEachTab = (state, fn) => {
    if (!state.tabs) state.tabs = emptyTabs();
    CHAT_TABS.forEach((tab) => {
        if (Array.isArray(state.tabs[tab])) fn(state.tabs[tab], tab);
    });
};

const chatListSlice = createSlice({
    name: 'chatList',
    initialState,
    reducers: {
        // SQL se padha hua poora data
        setAllTabs: (state, action) => {
            const incoming = action.payload ?? {};
            // Kisi purane build ka persisted state aa jaye to state.tabs missing
            // ho sakta hai — defensive taki reducer na toote.
            if (!state.tabs) state.tabs = emptyTabs();
            CHAT_TABS.forEach((tab) => {
                state.tabs[tab] = Array.isArray(incoming[tab]) ? incoming[tab] : [];
            });
            // Server ne read abhi process na kiya ho to bhi khuli chat par badge na aaye
            const activeId = state.activeChatId;
            if (activeId) {
                forEachTab(state, (list) => {
                    const chat = list.find((c) => c._id === activeId);
                    if (chat) { chat.unreadCount = 0; chat.unseenCount = 0; }
                });
                state.tabs.Unread = state.tabs.Unread.filter((c) => c._id !== activeId);
            }
            state.error = null;
        },

        loadStarted: (state) => { state.loading = true; },
        loadFinished: (state) => { state.loading = false; },

        syncStarted: (state) => { state.syncing = true; state.error = null; },
        syncFinished: (state, action) => {
            state.syncing = false;
            if (action.payload) state.lastSyncedAt = action.payload;
        },
        syncFailed: (state, action) => {
            state.syncing = false;
            // API fail hone par purana data chhedna nahi hai — sirf error rakho
            state.error = action.payload ?? 'sync failed';
        },

        // Socket se naya message (ya apna bheja hua) → lastMessage + unreadCount
        // update + chat TOP par. `chat` optional hai: list me chat na ho (naya user /
        // nayi chat) to isi se nayi row banti hai.
        updateChatLastMessage: (state, action) => {
            const { msg, myUserId, chat: fallbackChat } = action.payload;
            const incomingChatId = msg?.chat?._id ?? msg?.chat;
            if (!incomingChatId) return;

            const senderId = msg?.sender?._id ?? msg?.sender;
            const isMine = !!myUserId && senderId === myUserId;
            const isActive = state.activeChatId === incomingChatId;
            let updated = null;
            let found = false;

            forEachTab(state, (list) => {
                const idx = list.findIndex((c) => c._id === incomingChatId);
                if (idx === -1) return;
                found = true;
                const chat = list[idx];
                // Same message do events (message-received + new-message) se aa sakta hai
                const isDuplicate = !!msg?._id && chat.latestMessage?._id === msg._id;
                const prevUnread = chat.unreadCount ?? chat.unseenCount ?? 0;
                updated = {
                    ...chat,
                    latestMessage: msg,
                    updatedAt: msg.createdAt ?? chat.updatedAt,
                    unreadCount: isActive ? 0 : (isMine || isDuplicate ? prevUnread : prevUnread + 1),
                    unseenCount: undefined,
                };
                list.splice(idx, 1);
                list.unshift(updated);
            });

            if (!found) {
                if (!fallbackChat) return;
                updated = {
                    ...fallbackChat,
                    _id: incomingChatId,
                    latestMessage: msg,
                    updatedAt: msg.createdAt ?? Date.now(),
                    unreadCount: isMine || isActive ? 0 : 1,
                };
                const targets = ['All', 'Calls'];
                if (updated.isGroupChat) targets.push('Groups');
                targets.forEach((tab) => {
                    if (Array.isArray(state.tabs[tab])) state.tabs[tab].unshift({ ...updated });
                });
            }

            // Unread tab derived hai: naya unread aaya to chat wahan bhi aani chahiye
            if (updated && (updated.unreadCount ?? 0) > 0) {
                const unread = state.tabs.Unread;
                if (Array.isArray(unread) && !unread.some((c) => c._id === incomingChatId)) {
                    unread.unshift({ ...updated });
                }
            }
        },

        // Chat screen band karte waqt us chat ka sabse naya message list me daal do
        // (unread nahi chhedta). Sirf tab jab ye list wale se naya ho.
        setChatLatestMessage: (state, action) => {
            const { chatId, msg } = action.payload ?? {};
            if (!chatId || !msg?.createdAt) return;
            const newTime = new Date(msg.createdAt).getTime();
            forEachTab(state, (list) => {
                const idx = list.findIndex((c) => c._id === chatId);
                if (idx === -1) return;
                const chat = list[idx];
                const oldTime = new Date(chat.latestMessage?.createdAt ?? chat.updatedAt ?? 0).getTime() || 0;
                const sameMsg = chat.latestMessage?._id && chat.latestMessage._id === msg._id;
                if (!sameMsg && newTime <= oldTime) return;
                // isDeleted jaisa badlav bhi dikhe, isliye same message ho to bhi update
                list[idx] = { ...chat, latestMessage: msg, updatedAt: sameMsg ? chat.updatedAt : msg.createdAt };
                if (!sameMsg && idx > 0) {
                    const [moved] = list.splice(idx, 1);
                    list.unshift(moved);
                }
            });
        },

        // Chat screen khuli / band hui
        setActiveChat: (state, action) => {
            state.activeChatId = action.payload ?? null;
        },

        // Chat open karne par unread = 0
        clearUnread: (state, action) => {
            const chatId = action.payload;
            forEachTab(state, (list) => {
                const chat = list.find((c) => c._id === chatId);
                if (chat) { chat.unreadCount = 0; chat.unseenCount = 0; }
            });
            // Unread tab me ab ye chat nahi honi chahiye
            state.tabs.Unread = (state.tabs.Unread ?? []).filter((c) => c._id !== chatId);
        },

        // Pin / mute / archive jaise flags turant list me dikhane ke liye.
        // Pinned chats hamesha upar (server bhi pinned first bhejta hai).
        updateChatFlags: (state, action) => {
            const { chatId, patch } = action.payload ?? {};
            if (!chatId || !patch) return;
            forEachTab(state, (list) => {
                const idx = list.findIndex((c) => c._id === chatId);
                if (idx !== -1) list[idx] = { ...list[idx], ...patch };
            });
        },

        setBlockedIds: (state, action) => {
            state.blockedIds = Array.isArray(action.payload) ? action.payload : [];
        },

        setUserBlocked: (state, action) => {
            const { userId, blocked } = action.payload ?? {};
            if (!userId) return;
            const ids = (state.blockedIds ?? []).filter((id) => id !== userId);
            if (blocked) ids.push(userId);
            state.blockedIds = ids;
        },

        // Chat delete (local)
        removeChat: (state, action) => {
            const chatId = action.payload;
            if (!state.tabs) state.tabs = emptyTabs();
            CHAT_TABS.forEach((tab) => {
                state.tabs[tab] = (state.tabs[tab] ?? []).filter((c) => c._id !== chatId);
            });
        },

        // Logout par clear
        clearChatList: (state) => {
            state.tabs = emptyTabs();
            state.loading = false;
            state.syncing = false;
            state.lastSyncedAt = null;
            state.error = null;
            state.activeChatId = null;
            state.blockedIds = [];
        },
    },
});

export const {
    setAllTabs,
    loadStarted,
    loadFinished,
    syncStarted,
    syncFinished,
    syncFailed,
    updateChatLastMessage,
    setChatLatestMessage,
    setActiveChat,
    clearUnread,
    removeChat,
    clearChatList,
    updateChatFlags,
    setBlockedIds,
    setUserBlocked,
} = chatListSlice.actions;

export default chatListSlice.reducer;
