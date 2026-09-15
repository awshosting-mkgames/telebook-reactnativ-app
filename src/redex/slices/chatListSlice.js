import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import apiService from '../../services/apiService';
import Config from '../../services/config';
const BASE_URL = Config.Main_url;

const DEFAULT_AVATAR = 'https://cdn-icons-png.flaticon.com/512/149/149071.png';
const DEFAULT_GROUP = 'https://cdn-icons-png.flaticon.com/512/681/681494.png';

const resolveAvatar = (path, fallback) => (!path ? fallback : Config.MEDIA_URL + path);

// ── Helper: raw API chat → display-ready object ───────────────────────────────
const processChat = (item, myUserId) => {
    if (item?.isGroupChat) {
        return {
            ...item,
            displayName: item.chatName || 'Group',
            displayAvatar: resolveAvatar(item.groupIcon, DEFAULT_GROUP),
            displayUser: null,
        };
    }
    const other = item?.users?.find((u) => u?._id !== myUserId);
    return {
        ...item,
        displayName: other?.name || item.chatName || 'Unknown',
        displayAvatar: resolveAvatar(other?.profilePicture, DEFAULT_AVATAR),
        displayUser: other || null,
    };
};

const initialState = {
    chats: [],
    loading: false,
    error: null,
};

// ── Fetch chat list ───────────────────────────────────────────────────────────
export const fetchChatList = createAsyncThunk(
    'chatList/fetch',
    async ({ filter = 'All', myUserId }, thunkAPI) => {
        try {
            const endpointMap = {
                All: 'chats',
                Groups: 'chats/groups',
                Unread: 'chats',
                Calls: 'chats',
            };
            const response = await apiService({
                method: 'GET',
                endpoint: endpointMap[filter] ?? 'chats',
            });
            let raw = Array.isArray(response?.data?.chats)
                ? response.data.chats
                : Array.isArray(response?.data) ? response.data : [];
            if (filter === 'Groups') {
                raw = Array.isArray(response?.data?.groups)
                    ? response.data.groups
                    : Array.isArray(response?.data) ? response.data : [];
            }

            return raw.map((item) => processChat(item, myUserId));
        } catch (error) {
            return thunkAPI.rejectWithValue(error.message);
        }
    }
);

// ── Slice ─────────────────────────────────────────────────────────────────────
const chatListSlice = createSlice({
    name: 'chatList',
    initialState,
    reducers: {
        // Socket se naya message aaya → lastMessage + unreadCount update + chat TOP par
        updateChatLastMessage: (state, action) => {
            const { msg, myUserId } = action.payload;
            const incomingChatId = msg?.chat?._id ?? msg?.chat;
            if (!incomingChatId) return;

            const idx = state.chats.findIndex((c) => c._id === incomingChatId);
            if (idx === -1) return; // chat list mein nahi — fetchChatList call karo

            const chat = state.chats[idx];
            const isMine = msg?.sender?._id === myUserId;

            const updated = {
                ...chat,
                latestMessage: msg,
                updatedAt: msg.createdAt,
                unreadCount: isMine
                    ? (chat.unreadCount ?? 0)
                    : (chat.unreadCount ?? 0) + 1,
            };

            // Remove from current position and put at top
            state.chats.splice(idx, 1);
            state.chats.unshift(updated);
        },

        // Chat open karne par unread = 0
        clearUnread: (state, action) => {
            const chatId = action.payload;
            const chat = state.chats.find((c) => c._id === chatId);
            if (chat) chat.unreadCount = 0;
        },

        // Chat delete (local)
        removeChat: (state, action) => {
            state.chats = state.chats.filter((c) => c._id !== action.payload);
        },

        // Logout par clear
        clearChatList: (state) => {
            state.chats = [];
            state.error = null;
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(fetchChatList.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchChatList.fulfilled, (state, action) => {
                state.loading = false;
                state.chats = action.payload;
            })
            .addCase(fetchChatList.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload || action.error.message;
            });
    },
});

export const {
    updateChatLastMessage,
    clearUnread,
    removeChat,
    clearChatList,
} = chatListSlice.actions;

export default chatListSlice.reducer;
