import {
    RecordingPresets,
    requestRecordingPermissionsAsync,
    setAudioModeAsync,
    useAudioRecorder,
} from "expo-audio";
import { useNameResolver } from "../../services/nameResolver";
import { saveUnknownContact } from "../../services/saveContactFlow";
import { seedMediaCache } from "../../utils/mediaCache";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
    ActivityIndicator,
    Alert,
    Animated,
    AppState,
    BackHandler,
    Dimensions,
    ImageBackground,
    Keyboard,
    KeyboardAvoidingView,
    Linking,
    Modal,
    Platform,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { useDispatch, useSelector } from "react-redux";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ThemeContext } from "../../components/ThemeContext";
import apiService from "../../services/apiService";
import Config from "../../services/config";
import socketService from "../../services/socketService";
import { clearUnread, setActiveChat, setChatLatestMessage, updateChatLastMessage } from "../../redex/slices/chatListSlice";
import { persistChatTabs, syncAllTabData } from "../../services/chatSync";
import { apiErrorMessage, setBlocked } from "../../services/chatActions";
import { startCall } from "../../services/callHelpers";
import { getCachedCallsConfig } from "../../services/callConfigStore";
import {
    loadCachedMessages, cacheMessages, getMemoryMessages, uncacheMessage, markMessagesDeleted, syncChat, detachSync, isTombstoned,
    clearChatCache, removeMessagesLocally,
} from "../../services/messageSync";
import { getMessagesPage, getSyncState } from "../../services/messagesDb";
import {
    AUTO_RETRY_DELAYS, applyPendingEvent, autoRetryAttempts, cancelledUploads, enqueueUpload, getPending, patchPending, removePending,
    registerRetry, resolvePending, subscribePending, unregisterRetry, upsertPending,
} from "../../services/pendingMedia";
import Images from "../../utils/images";

import AttachSheet from "./components/AttachSheet";
import ReactionBar from "./components/ReactionBar";
import ChatHeader from "./components/ChatHeader";
import ForwardContactModal from "./components/ForwardContactModal";
import { ImageViewer, VideoModal } from "./components/MediaViewers";
import MessageList from "./components/MessageList";
import MessagePopup from "./components/MessagePopup";
import SearchNavBar from "./components/SearchNavBar";
import TextInputSection from "./components/TextInputSection";
import Toast from "react-native-toast-message";
import { isDeleteWindowExpired, isEditWindowExpired, windowErrorMessage } from "../../services/messageWindows";
import { appendFile } from '../../utils/uploadFile';
import { stopPlayback } from "../../utils/playbackManager";
import { launchCameraAsync } from '../../services/cameraGuard';

const DEFAULT_AVATAR = "https://cdn-icons-png.flaticon.com/512/149/149071.png";
const DEFAULT_GRP_AVT = 'https://cdn-icons-png.flaticon.com/512/681/681494.png';

const idOf = (v) => v?._id ?? v;
const byNewest = (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0);

// Server refresh (cache -> fetch -> reconnect -> foreground) har baar sab messages ke NAYE objects deta hai,
// jisse poori list dobara render/layout hoti thi (unlock ke baad chat ka upar-neeche jhatka). Jo message
// asal me nahi badla uska purana object rakho => sirf badle hue rows render hote hain.
const sameJson = (a, b) => { try { return JSON.stringify(a) === JSON.stringify(b); } catch { return false; } };
const sameMsg = (a, b) => a === b || (
    a._id === b._id && a.status === b.status && a.content === b.content && a.isEdited === b.isEdited
    && a.isDeleted === b.isDeleted && a.updatedAt === b.updatedAt
    && (a.reactions?.length ?? 0) === (b.reactions?.length ?? 0)
    && (a.starredBy?.length ?? 0) === (b.starredBy?.length ?? 0)
    && (a.readBy?.length ?? 0) === (b.readBy?.length ?? 0)
    && (a.deliveredTo?.length ?? 0) === (b.deliveredTo?.length ?? 0)
    && a.attachments?.[0]?.url === b.attachments?.[0]?.url
    && a.uploadProgress === b.uploadProgress
);
const stabilizeList = (prev, next) => {
    const old = new Map(prev.map((m) => [m._id, m]));
    const out = next.map((m) => { const o = old.get(m._id); return o && sameMsg(o, m) ? o : m; });
    return out.length === prev.length && out.every((m, i) => m === prev[i]) ? prev : out;
};

// Background sync / cache ke batch ko list me MERGE karo (kabhi replace nahi) — existing rows ki identity bachi rehti hai
// (sirf badle hue re-render), naye/purane rows sahi jagah, aur order stable => inverted list me scroll position nahi hilti.
// addOnly: cache se aaye rows sirf jodo (state me pehle se maujood — jaise pending upload — ko overwrite mat karo).
// Delete-for-everyone wali row ko koi purana (undeleted) batch wapas zinda nahi kar sakta.
const mergeBatch = (chatId, prev, incoming, { addOnly = false } = {}) => {
    const upd = new Map();
    incoming.forEach((m) => { if (m?._id && (m.isDeleted || !isTombstoned(chatId, m._id))) upd.set(m._id, m); });
    if (!upd.size) return prev;
    const prevIds = new Set(prev.map((m) => m._id));
    let out = prev;
    if (!addOnly) {
        out = prev.map((m) => {
            const f = upd.get(m._id);
            if (!f || m.isOptimistic) return m;
            if (m.isDeleted && !f.isDeleted) return m;
            return sameMsg(m, f) ? m : f;
        });
    }
    const adds = [...upd.values()].filter((m) => !prevIds.has(m._id));
    if (adds.length) {
        adds.sort(byNewest);
        const last = out[out.length - 1];
        const lastT = last ? new Date(last.createdAt || 0).getTime() : Infinity;
        // Common case (purani history crawl): sab naye rows list ke aakhir se bhi purane => bas jod do, sort nahi
        out = new Date(adds[0].createdAt || 0).getTime() <= lastT ? [...out, ...adds] : [...out, ...adds].sort(byNewest);
    }
    return out.length === prev.length && out.every((m, i) => m === prev[i]) ? prev : out;
};

// Contact screen raw key (uploads/...) bhejti hai, list poora URL — dono sambhalo
const toImageUrl = (v, fallback) => {
    if (!v) return fallback;
    return /^(https?:|file:|data:)/.test(v) ? v : `${Config?.MEDIA_URL}${v}`;
};

// Server reactions ka shape { user, emoji } hai (ek user = ek reaction). emoji khaali = hatao.
const withReaction = (m, userIdRaw, emoji) => {
    // Ek user ki ek hi reaction: pehle hata ke (nayi ho to) jodte hain — same event do baar aaye to bhi count double nahi hota
    const userId = idOf(userIdRaw);
    const others = (m.reactions ?? []).filter((r) => idOf(r.user ?? r.userId) !== userId);
    return { ...m, reactions: emoji ? [...others, { user: userId, emoji }] : others };
};

// Star set-semantics: mera id add/remove — same state dobara lage to koi badlav nahi (idempotent)
const withStar = (m, userId, starred) => {
    const others = (m.starredBy ?? []).filter((u) => idOf(u) !== userId);
    return { ...m, starredBy: starred ? [...others, userId] : others };
};

export default function ChatScreen({ route, navigation }) {
    const { chatId, broadcastIds = [] } = route.params;
    const dispatch = useDispatch();
    const insets = useSafeAreaInsets();

    const { t } = useTranslation();
    const { theme } = useContext(ThemeContext);
    const isDark = theme?.mode ? theme.mode === 'dark' : theme?.text === '#FFFFFF';

    const maniAllData = useSelector((state) => state.totalappData);
    const MY_USER_ID = maniAllData?.userId ?? "";
    const blockedIds = useSelector((state) => state.chatList?.blockedIds ?? []);

    // Chat list se aaya naam/photo turant dikhao — API ka intezar mat karo
    const [chatName, setchatName] = useState(route.params?.chatName ?? "");
    // Header/list naam hamesha phonebook rule se (saved naam > number); server ka profile naam kabhi title nahi
    const resolveName = useNameResolver();
    const resolveNameRef = useRef(resolveName);
    resolveNameRef.current = resolveName;
    const [chatImage, setchatImage] = useState(toImageUrl(route.params?.chatImage, route.params?.isGroup ? DEFAULT_GRP_AVT : DEFAULT_AVATAR));
    const [isGroup, setIsGroup] = useState(!!route.params?.isGroup);
    const [isBroadcast, setIsBroadcast] = useState(false);
    const [otherUserId, setOtherUserId] = useState(route.params?.otherUserId ?? null);
    const [chatDaetils, setchatDaetils] = useState("");
    // Memory cache ho to pehle hi frame me messages (spinner/blank nahi)
    const [messages, setMessages] = useState(() => (getMemoryMessages(route.params?.chatId) || []));
    const [cacheReady, setCacheReady] = useState(messages.length > 0);
    const [inputText, setInputText] = useState("");
    const [loading, setLoading] = useState(messages.length === 0);
    const [sending, setSending] = useState(false);
    const [isTyping, setIsTyping] = useState(false);
    const [replyMsg, setReplyMsg] = useState(null);
    const [editMsg, setEditMsg] = useState(null);
    const [selectedMsg, setSelectedMsg] = useState(null);
    // Long-press par pressed bubble ki window position: reaction bar / popup message ke paas (selAnchor.id = kis message ka)
    const [selAnchor, setSelAnchor] = useState(null);
    const [popupAnchor, setPopupAnchor] = useState(null);
    const rootRef = useRef(null);
    const rootYRef = useRef(0);
    const [showPopup, setShowPopup] = useState(false);
    const [showEmoji, setShowEmoji] = useState(false);
    const [showAttach, setShowAttach] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
    const [recordSecs, setRecordSecs] = useState(0);
    const [videoModalUri, setVideoModalUri] = useState(null);
    const [imageModalUri, setImageModalUri] = useState(null);
    const [keyboardH, setKeyboardH] = useState(0);
    const [isOnline, setIsOnline] = useState(false);
    const [showForward, setShowForward] = useState(false);
    const [forwardMsgIds, setForwardMsgIds] = useState([]);
    const [isSelectMode, setIsSelectMode] = useState(false);
    const [selectedMsgIds, setSelectedMsgIds] = useState(new Set());
    // Purani history ab page-by-page nahi: phone ka SQLite source of truth hai aur background sync (messageSync.syncChat)
    // saari history khud laata hai. historyComplete = poori history phone me; backfilling = abhi sync chal raha.
    const [historyComplete, setHistoryComplete] = useState(false);
    const [backfilling, setBackfilling] = useState(false);
    const isBlocked = !isGroup && !!otherUserId && blockedIds.includes(otherUserId);
    // Locked group me sirf admin likh sakte hain (owner = groupAdmin, promoted = admins)
    const isGroupAdmin = [...(chatDaetils?.groupAdmin ?? []), ...(chatDaetils?.admins ?? [])].some((u) => idOf(u) === MY_USER_ID);
    const isLockedForMe = isGroup && !!chatDaetils?.isLocked && !isGroupAdmin;
    // Delete ho chuka account chat me "Deleted account" naam se rehta hai (API doc rule 13)
    const otherChatUser = !isGroup ? chatDaetils?.users?.find((u) => idOf(u) !== MY_USER_ID) : null;
    const isOtherDeleted = !!otherChatUser && (otherChatUser.isDeleted === true || otherChatUser.name === "Deleted account");
    // Block: jisne mujhe block kiya (server `blockedMe:true` bhejta hai) ya jise maine block kiya — uski photo, online,
    // typing aur last seen chat screen par nahi dikhte, sirf naam.
    const hideCounterpart = !isGroup && (isBlocked || !!otherChatUser?.blockedMe);

    const [isSearchMode, setIsSearchMode] = useState(false);
    const [searchText, setSearchText] = useState("");
    const [searchResults, setSearchResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    const [searchMatchIds, setSearchMatchIds] = useState([]);       // saare matched message ids
    const [currentMatchIndex, setCurrentMatchIndex] = useState(-1); // abhi konsa match active hai
    const [searchScrollNonce, setSearchScrollNonce] = useState(0);  // same id dobara tap ho to bhi re-trigger
    const searchTimer = useRef(null);

    const flatRef = useRef();
    const typingTimer = useRef();
    const recordTimer = useRef();
    const scaleAnim = useRef(new Animated.Value(1)).current;
    const appState = useRef(AppState.currentState);

    useEffect(() => {
        const show = Keyboard.addListener("keyboardDidShow", (e) => setKeyboardH(e.endCoordinates.height));
        const hide = Keyboard.addListener("keyboardDidHide", () => setKeyboardH(0));
        return () => { show.remove(); hide.remove(); };
    }, []);

    useEffect(() => () => clearTimeout(searchTimer.current), []);

    // Ye chat khuli hai → list me iska unread na badhe; band hone par badge saaf
    const messagesRef = useRef([]);
    messagesRef.current = messages;
    // Chat sach me screen par hai? (upar profile / media screen khuli ho to nahi)
    const isFocusedRef = useRef(false);
    // Screen chhupi thi tab dusre ka message aaya → wapas aane par read mark karna hai
    const missedReadRef = useRef(false);
    useFocusEffect(useCallback(() => {
        isFocusedRef.current = true;
        dispatch(setActiveChat(chatId));
        dispatch(clearUnread(chatId));
        if (missedReadRef.current) {
            missedReadRef.current = false;
            refreshLatestRef.current?.();
        }
        return () => {
            isFocusedRef.current = false;
            dispatch(setActiveChat(null));
            dispatch(clearUnread(chatId));
            // List ka "last message" is chat ke asli sabse naye message se mila do
            const newest = messagesRef.current.find((m) => !m.isOptimistic && m.status !== "failed");
            if (newest) dispatch(setChatLatestMessage({ chatId, msg: newest }));
            dispatch(persistChatTabs());
        };
    }, [chatId, dispatch]));

    const otherUserIdRef = useRef(otherUserId);
    otherUserIdRef.current = otherUserId;

    // Background me socket band rehta hai (API doc rule 4). Wapas aane par jo
    // messages / ticks miss hue unhe page 1 dobara laakar mila do, aur status poochho.
    useEffect(() => {
        const sub = AppState.addEventListener("change", (next) => {
            if (appState.current === "background" && next === "active") {
                if (otherUserIdRef.current) socketService.emit("get-user-status", { userId: otherUserIdRef.current });
                if (isFocusedRef.current) refreshLatestRef.current?.();
                else missedReadRef.current = true;
                // App foreground me wapas aana connectivity wapas aane ka bhi ek signal
                // hai — offline-queued messages yahin se retry ho jaate hain.
                retryQueuedRef.current?.();
            }
            appState.current = next;
        });
        return () => sub.remove();
    }, []);

    // Android back: pehle select / search / emoji / edit band, phir screen
    const backStateRef = useRef({});
    backStateRef.current = { isSelectMode, isSearchMode, showEmoji, editMsg };
    useFocusEffect(useCallback(() => {
        const sub = BackHandler.addEventListener("hardwareBackPress", () => {
            const st = backStateRef.current;
            if (st.isSelectMode) { setIsSelectMode(false); setSelectedMsgIds(new Set()); return true; }
            if (st.isSearchMode) { closeSearchRef.current?.(); return true; }
            if (st.editMsg) { setEditMsg(null); setInputText(""); return true; }
            if (st.showEmoji) { setShowEmoji(false); return true; }
            return false;
        });
        return () => sub.remove();
    }, []));

    // Typing indicator ka "stop-typing" miss ho jaye to hamesha "typing..." na dikhe
    const typingClearTimer = useRef(null);
    // Receipt kabhi POST ke jawab se pehle aa jati hai (tab message abhi temp id par hai)
    const pendingReceipts = useRef({});
    useEffect(() => () => {
        clearTimeout(typingClearTimer.current);
        clearTimeout(typingTimer.current);
        clearInterval(recordTimer.current);
        if (typingActive.current) socketService.emit("stop-typing", { chatId });
        // Recording chal rahi ho aur screen band ho jaye to mic band karo
        try { if (audioRecorder.isRecording) audioRecorder.stop(); } catch { }
    }, []);

    useEffect(() => {
        socketService.joinChat(chatId);
        const onMessageReceived = (msg) => {
            const msgChatId = msg?.chat?._id ?? msg?.chat;
            if (msgChatId === chatId) {
                const senderId = msg?.sender?._id ?? msg?.sender;
                setMessages((prev) => {
                    if (prev.some((m) => m._id === msg._id)) return prev;
                    const replyTo = typeof msg.replyTo === "string"
                        ? prev.find((m) => m._id === msg.replyTo) ?? null
                        : msg.replyTo;
                    return [{ ...msg, replyTo, status: "delivered" }, ...prev];
                });
                cacheMessages(chatId, [msg]);
                if (senderId === MY_USER_ID) return;
                setIsTyping(false);

                if (AppState.currentState === "active" && isFocusedRef.current) {
                    socketService.emit("message-read", { messageId: msg._id, chatId });
                } else {
                    missedReadRef.current = true;
                }
            }
        };
        const isOtherUser = (uid) => !!uid && uid === otherUserIdRef.current;
        const markLastSeenNow = (uid) => setchatDaetils((prev) => (prev?.users
            ? { ...prev, users: prev.users.map((u) => ((u?._id ?? u) === uid ? { ...u, lastSeen: new Date().toISOString() } : u)) }
            : prev));
        const onStatusUpdate = ({ userId, status }) => { if (isOtherUser(userId)) setIsOnline(status === "online"); };
        const onTyping = ({ chatId: c, userId }) => {
            if (c !== chatId || userId === MY_USER_ID) return;
            setIsTyping(true);
            clearTimeout(typingClearTimer.current);
            typingClearTimer.current = setTimeout(() => setIsTyping(false), 5000);
        };
        const onStopTyping = ({ chatId: c }) => { if (c === chatId) { clearTimeout(typingClearTimer.current); setIsTyping(false); } };
        // Receipt: read ka matlab delivered bhi. Message abhi temp id par ho to yaad rakho.
        const applyReceipt = (messageId, kind) => setMessages((prev) => {
            if (!prev.some((m) => m._id === messageId)) {
                if (pendingReceipts.current[messageId] !== "read") pendingReceipts.current[messageId] = kind;
                return prev;
            }
            return prev.map((m) => {
                if (m._id !== messageId || m.status === "read") return m;
                return kind === "read"
                    ? { ...m, status: "read", readBy: m.readBy?.length ? m.readBy : [{ _id: "read" }], deliveredTo: m.deliveredTo?.length ? m.deliveredTo : [{ _id: "del" }] }
                    : { ...m, status: "delivered", deliveredTo: m.deliveredTo?.length ? m.deliveredTo : [{ _id: "del" }] };
            });
        });
        const onReadUpdate = ({ messageId, chatId: c }) => { if (!c || c === chatId) applyReceipt(messageId, "read"); };
        const onDeliveredUpdate = ({ messageId, chatId: c }) => { if (!c || c === chatId) applyReceipt(messageId, "delivered"); };
        const onDeleted = ({ messageId, chatId: c }) => {
            if (c && c !== chatId) return;
            markMessagesDeleted(chatId, [messageId]);
            setMessages((prev) => prev.map((m) => m._id === messageId ? { ...m, isDeleted: true, content: "This message was deleted", attachments: [] } : m));
        };
        const onBulkDeleted = ({ messageIds, chatId: deletedChatId }) => {
            if (deletedChatId && deletedChatId !== chatId) return;
            markMessagesDeleted(chatId, messageIds);
            setMessages((prev) => prev.map((m) =>
                messageIds.includes(m._id)
                    ? { ...m, isDeleted: true, content: 'This message was deleted', attachments: [] }
                    : m
            ));
        };
        const onReaction = ({ messageId, emoji, userId }) => {
            setMessages((prev) => prev.map((m) => (m._id === messageId ? withReaction(m, userId, emoji) : m)));
        };
        const onEdited = ({ messageId, newContent, chatId: c, editedAt }) => {
            if (c && c !== chatId) return;
            setMessages((prev) => prev.map((m) => (m._id === messageId ? { ...m, content: newContent, isEdited: true, editedAt } : m)));
        };
        socketService.on("message-received", onMessageReceived);
        socketService.on("user-status-result", onStatusUpdate);
        socketService.on("typing", onTyping);
        socketService.on("stop-typing", onStopTyping);
        socketService.on("message-read-update", onReadUpdate);
        socketService.on("message-delivered-update", onDeliveredUpdate);
        socketService.on("message-deleted", onDeleted);
        socketService.on("messages-deleted", onBulkDeleted);
        socketService.on("message-reaction-update", onReaction);
        socketService.on("message-edited", onEdited);
        // M08: server mere baaki devices ko star change batata hai — _id se patch, set-semantics (idempotent)
        const onStarred = ({ messageId, chatId: c, isStarred }) => {
            if (c && c !== chatId) return;
            setMessages((prev) => prev.map((m) => (m._id === messageId ? withStar(m, MY_USER_ID, !!isStarred) : m)));
        };
        socketService.on("message-starred", onStarred);
        // Group lock / admin / naam badla → header aur input turant sahi
        const onGroupUpdated = (chat) => {
            if (idOf(chat) !== chatId || typeof chat !== "object") return;
            setchatDaetils((prev) => ({ ...(prev || {}), ...chat }));
            if (chat.chatName) setchatName(chat.chatName);
        };
        socketService.on("group-updated", onGroupUpdated);
        const onUserOnline = (uid) => { if (isOtherUser(uid)) setIsOnline(true); };
        const onUserOffline = (uid) => { if (isOtherUser(uid)) { setIsOnline(false); markLastSeenNow(uid); } };
        socketService.on("user-online", onUserOnline);
        socketService.on("user-offline", onUserOffline);
        // Reconnect (network wapas aaya) → agar chat abhi screen par hai to taaza kar lo,
        // aur offline-queued messages bhi retry karo (socket reconnect sabse reliable
        // "internet wapas aa gaya" signal hai — isko chat focused na hone par bhi suno).
        // refreshLatestRef se stale-closure bug nahi hota (AppState effect jaisa).
        const onConnect = () => {
            if (isFocusedRef.current) refreshLatestRef.current?.();
            retryQueuedRef.current?.();
        };
        socketService.on("connect", onConnect);
        // Sirf apne listeners hatao. Bina callback ke off() karne se chat list
        // (Freechat) ke listeners bhi hat jate the aur list update hona band ho jata tha.
        return () => {
            socketService.off("message-received", onMessageReceived);
            socketService.off("user-status-result", onStatusUpdate);
            socketService.off("typing", onTyping);
            socketService.off("stop-typing", onStopTyping);
            socketService.off("message-read-update", onReadUpdate);
            socketService.off("message-delivered-update", onDeliveredUpdate);
            socketService.off("message-deleted", onDeleted);
            socketService.off("messages-deleted", onBulkDeleted);
            socketService.off("message-reaction-update", onReaction);
            socketService.off("message-edited", onEdited);
            socketService.off("message-starred", onStarred);
            socketService.off("group-updated", onGroupUpdated);
            socketService.off("user-online", onUserOnline);
            socketService.off("user-offline", onUserOffline);
            socketService.off("connect", onConnect);
            socketService.leaveChat(chatId);
        };
    }, [chatId, MY_USER_ID]);

    useEffect(() => {
        if (otherUserId && !isGroup) socketService.emit("get-user-status", { userId: otherUserId });
    }, [otherUserId, isGroup]);

    // Offline-first: SQLite hi source of truth. Memory mirror ho to pehle frame me hi saare messages; warna SQL se
    // pehle newest 300 (jaldi pehla frame), phir poora cache (koi cap nahi) list me jud jata hai. Uske baad
    // background sync (delta / newest + silent purani history) — user ko scroll/refresh karke "agle 60" nahi maangne.
    useEffect(() => {
        let cancelled = false;
        (async () => {
            const hadMemory = messagesRef.current.some((m) => !m.isOptimistic);
            const fromCache = (rows) => rows.map((m) => ({ ...m, status: cachedStatus(m) }));
            let cachedCount = hadMemory ? messagesRef.current.length : 0;
            try {
                getSyncState(chatId).then((st) => { if (!cancelled && st.historyComplete) setHistoryComplete(true); }).catch(() => { });
                if (!hadMemory) {
                    const first = await getMessagesPage(chatId, { limit: 300 });
                    if (cancelled) return;
                    cachedCount = first.length;
                    if (first.length) setMessages((prev) => mergeBatch(chatId, prev, fromCache(first), { addOnly: true }).slice().sort(byNewest));
                    setCacheReady(true);
                    if (first.length) setLoading(false);
                    if (first.length >= 300) {
                        const all = await loadCachedMessages(chatId);   // poora cache (memory mirror bhi bharta hai)
                        if (cancelled) return;
                        cachedCount = all.length;
                        setMessages((prev) => mergeBatch(chatId, prev, fromCache(all), { addOnly: true }));
                    }
                }
            } catch (e) { console.log("cache load error:", e); }
            if (cancelled) return;
            setCacheReady(true);
            if (cachedCount) setLoading(false);
            startSync();
        })();
        return () => { cancelled = true; detachSync(chatId, syncHandlersRef.current); };
    }, [chatId]);
    // isGroup baad me pata chale (GET /messages ke chatDetails se) to sahi endpoint se dobara
    useEffect(() => { fetchChatDetails(); }, [isGroup]);
    const isEmpty = (value) => {
        if (value === null || value === undefined || value === '') {
            return false;
        }
        return true;
    };

    const fetchChatDetails = async () => {
        try {
            // Group ka info alag endpoint par hai (API doc 6.3)
            const endpoint = isGroup ? `chats/group/${chatId}/info` : `chats/${chatId}/info`;
            const res = await apiService({ method: "GET", endpoint });
            if (!res?.success) return;
            // chatDaetils (header ka last seen) GET /messages ke chatDetails se aata hai —
            // yahan overwrite nahi karte, warna race me last seen gayab ho jata tha.
            const chatData = res?.data?.chat;
            if (isGroup || res?.data?.isGroupChat === true || res?.data?.group) {
                const grp = res?.data?.group;
                if (grp?.chatName) setchatName(grp.chatName);
                setchatImage(isEmpty(grp?.groupIcon) ? getFullUrl(grp?.groupIcon) : DEFAULT_GRP_AVT);
            } else {
                const otherUser = chatData?.otherUser;
                if (otherUser?._id && otherUser?._id !== MY_USER_ID) {
                    setOtherUserId(otherUser?._id);
                    setchatName(otherUser?.mobile ? resolveNameRef.current(otherUser).title : (route.params?.chatName || otherUser?.name || "TeleBook User"));
                    setchatImage(isEmpty(otherUser?.profilePicture) ? getFullUrl(otherUser?.profilePicture) : DEFAULT_AVATAR);
                }
            }
            setIsGroup(isGroup || !!res?.data?.isGroupChat || !!res?.data?.group);
            setIsBroadcast(chatData?.isBroadcast || false);
        } catch (e) { console.error("Chat details error:", e); }
    };

    // Background sync (messageSync.syncChat): cursor ho to delta (naye + edits + delete-for-everyone + delete-for-me),
    // warna newest page; phir purani history silent crawl. Har batch merge hota hai — kabhi list replace nahi, isliye
    // deleted rows wapas nahi aate aur scroll position nahi hilti. Dobara bulane par wahi in-flight sync (dedupe).
    const syncHandlersRef = useRef(null);
    const startSync = () => {
        const handlers = {
            onBatch: (msgs) => setMessages((prev) => mergeBatch(chatId, prev, msgs)),
            onRemoved: (ids) => { const gone = new Set(ids); setMessages((prev) => prev.filter((m) => !gone.has(m._id))); },
            onDetails: (details) => {
                setchatDaetils((prev) => (sameJson(prev, details) ? prev : details));
                if (details?.isGroupChat) setIsGroup(true);
                if (!details?.isGroupChat && !otherUserIdRef.current) {
                    const other = details?.users?.find((u) => (u?._id ?? u) !== MY_USER_ID);
                    if (other?._id) setOtherUserId(other._id);
                }
            },
            onProgress: ({ syncing, historyComplete: done }) => {
                setBackfilling(!!syncing);
                if (done !== undefined) setHistoryComplete(!!done);
            },
            onFirstSync: () => setLoading(false),
        };
        syncHandlersRef.current = handlers;
        return syncChat(chatId, handlers).then((r) => {
            setLoading(false);
            if (r?.ok) {
                dispatch(clearUnread(chatId));
                // Successful fetch khud proof hai ki connectivity hai — queued messages try karo.
                retryQueuedRef.current?.();
            } else if (messagesRef.current.length === 0 && isFocusedRef.current) {
                Alert.alert("Error", "Messages load nahi hue");
            }
            return r;
        });
    };
    // Unlock/foreground/reconnect/focus teeno ek saath refresh maangte hain — 2s ke andar dobara nahi (syncChat khud
    // bhi in-flight run share karta hai).
    const refreshLastAt = useRef(0);
    const refreshLatest = () => {
        if (Date.now() - refreshLastAt.current < 2000) return Promise.resolve();
        refreshLastAt.current = Date.now();
        return startSync();
    };
    const refreshLatestRef = useRef(null);
    refreshLatestRef.current = refreshLatest;

    // "Load older messages" button / list ke end par: sync atka ho (offline tha) to dobara chalao.
    const loadMoreMessages = () => { if (!backfilling) startSync(); };

    const determineStatus = (m) => {
        if (m.readBy?.length) return "read";
        if (m.deliveredTo?.length) return "delivered";
        return "sent";
    };
    // SQL me bachi hui failed/offline-queued (temp id) row ko "sent" dikhana galat tha —
    // asli status "failed" rakho taaki Retry dikhe (Point 15).
    const cachedStatus = (m) => (m.status === "failed" || m.offlineQueued || String(m._id).startsWith("temp_")
        ? "failed" : determineStatus(m));

    const onSearchChange = (text) => {
        setSearchText(text);
        clearTimeout(searchTimer.current);
        const q = text.trim();
        if (q.length < 2) { latestSearchRef.current = ""; setSearchResults([]); setSearchMatchIds([]); setCurrentMatchIndex(-1); setIsSearching(false); return; }
        setIsSearching(true);
        searchTimer.current = setTimeout(() => searchMessages(q), 400);
    };

    const latestSearchRef = useRef("");
    const searchMessages = async (query) => {
        latestSearchRef.current = query;
        try {
            setIsSearching(true);
            const res = await apiService({ method: "GET", endpoint: `messages/${chatId}`, params: { search: query } });
            // Purani query ka jawab der se aaye to use ignore karo
            if (latestSearchRef.current !== query) return;
            if (!res?.success) throw new Error(apiErrorMessage(res, "Search failed"));
            setSearchResults((res?.data?.messages ?? []).map((m) => ({ ...m, status: determineStatus(m) })));

            // ── VS Code jaisa navigation: saare matched ids store karo aur pehle match par jump ──
            // Sabse naya match pehle (neeche se shuru, WhatsApp jaisa). ↑ = purana, ↓ = naya.
            const found = res?.data?.messages ?? [];
            const timeOf = (id) => new Date(found.find((m) => m._id === id)?.createdAt ?? 0).getTime();
            const ids = res?.data?.isSearchResult
                ? [...(res?.data?.matchedIds ?? [])].sort((a, b) => timeOf(b) - timeOf(a))
                : [];
            setSearchMatchIds(ids);
            setCurrentMatchIndex(ids.length ? 0 : -1);
            setSearchScrollNonce((n) => n + 1); // pehle match par auto-scroll
        } catch (e) {
            console.error("Search error:", e);
            setSearchResults([]); setSearchMatchIds([]); setCurrentMatchIndex(-1);
        } finally { if (latestSearchRef.current === query) setIsSearching(false); }
    };

    // index par jao (wrap-around), aur MessageList ko scroll ke liye trigger karo
    const jumpToMatch = (index) => {
        if (!searchMatchIds.length) return;
        const next = (index + searchMatchIds.length) % searchMatchIds.length;
        setCurrentMatchIndex(next);
        setSearchScrollNonce((n) => n + 1);
    };
    const nextMatch = () => jumpToMatch(currentMatchIndex - 1); // ↓ naya match
    const prevMatch = () => jumpToMatch(currentMatchIndex + 1); // ↑ purana match

    const openSearch = () => { setIsSearchMode(true); setSearchText(""); setSearchResults([]); setSearchMatchIds([]); setCurrentMatchIndex(-1); setIsSearching(false); };
    const closeSearch = () => { clearTimeout(searchTimer.current); latestSearchRef.current = ""; setIsSearchMode(false); setSearchText(""); setSearchResults([]); setSearchMatchIds([]); setCurrentMatchIndex(-1); setIsSearching(false); };
    const closeSearchRef = useRef(null);
    closeSearchRef.current = closeSearch;

    const clearChat = () => {
        Alert.alert("Clear chat", "Is chat ke saare messages clear kar dein?", [
            { text: "Cancel", style: "cancel" },
            {
                text: "Clear", style: "destructive", onPress: async () => {
                    try {
                        const res = await apiService({ method: "DELETE", endpoint: `chats/${chatId}/clear` });
                        if (!res?.success) throw new Error(apiErrorMessage(res));
                        setMessages([]); setHistoryComplete(true); clearChatCache(chatId);
                        // List ka last message server se taaza ho jaye
                        syncAllTabData(dispatch, MY_USER_ID, { background: true });
                    } catch { Alert.alert("Error", "Chat clear nahi hui, dobara try karo"); }
                }
            },
        ]);
    };

    // "typing" ek hi baar bhejo, 2s tak kuch na likha to "stop-typing" (API doc section 7)
    const typingActive = useRef(false);
    const stopTyping = () => {
        clearTimeout(typingTimer.current);
        if (typingActive.current) socketService.emit("stop-typing", { chatId });
        typingActive.current = false;
    };
    const handleTyping = (text) => {
        setInputText(text);
        if (!text) { stopTyping(); return; }
        if (!typingActive.current) {
            typingActive.current = true;
            socketService.emit("typing", { chatId });
        }
        clearTimeout(typingTimer.current);
        typingTimer.current = setTimeout(stopTyping, 2000);
    };

    // Stored keys (uploads/...) → /media/<key>. Stickers static hain → /<key> (API doc 6.2).
    // Pehle se poora URL ho to waisa hi.
    const getFullUrl = (url) => {
        if (!url) return "";
        if (/^(https?:|file:|data:)/.test(url)) return url;
        if (url.startsWith("uploads/stickers/")) return `${Config?.Main_url}${url}`;
        return `${Config?.MEDIA_URL}${url}`;
    };
    const fmtSecs = (s) => `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;
    const fmtTime = (createdAt) => {
        if (!createdAt) return "";
        const d = new Date(createdAt);
        if (isNaN(d.getTime())) return "";
        const now = new Date();
        const isToday = d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        const yesterday = new Date(); yesterday.setDate(now.getDate() - 1);
        const isYesterday = d.getDate() === yesterday.getDate() && d.getMonth() === yesterday.getMonth() && d.getFullYear() === yesterday.getFullYear();
        if (isToday) return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", hour12: true });
        if (isYesterday) return "Yesterday";
        const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays < 7) return d.toLocaleDateString([], { weekday: "long" });
        return d.toLocaleDateString([], { day: "2-digit", month: "2-digit", year: "numeric" });
    };

    // Step 1 of 2 (API doc 4): POST /users/media, field "media" → { url, filename, fileType, fileSize }
    // onProgress(0-100) non-blocking multi-upload queue ke liye hai.
    // Note: pehle AbortController `signal` axios call ko diya jaata tha (true
    // cancel ke liye) — React Native par axios+FormData+signal ka combo upload
    // ko silently fail kar raha tha (images bhejna band ho gaya tha), isliye
    // hata diya. Cancel ab ek simple flag se hota hai (dekhen sendMediaAsset).
    const uploadMedia = async (localUri, mimeType, messageType, fileName, { onProgress } = {}) => {
        const fromUri = localUri.split("?")[0].split("/").pop() ?? "";
        const ext = fromUri.includes(".") ? fromUri.split(".").pop() : (mimeType.split("/")[1] ?? "bin");
        const fd = new FormData();
        await appendFile(fd, "media", { uri: localUri, name: fileName || `${messageType}_${Date.now()}.${ext}`, type: mimeType });

        const res = await apiService({
            method: "POST", endpoint: "users/media", data: fd, isMultipart: true,
            onUploadProgress: onProgress
                ? (evt) => { if (evt.total) onProgress(Math.round((evt.loaded / evt.total) * 100)); }
                : undefined,
        });
        const json = res?.data;
        if (!res?.success || !json?.success) {
            const err = new Error(json?.message ?? res?.error?.message ?? res?.error ?? "Media upload failed");
            // apiService: server tak request pahunchi aur mana kiya → error ek object
            // (error.response.data). Internet/server tak pahunchi hi nahi → error ek plain
            // string (error.message). Offline-queue yahi se decide karta hai (sendMediaAsset).
            err.isNetworkFailure = !res?.success && typeof res?.error === "string";
            err.status = res?.status;
            throw err;
        }
        return { url: json.data.url, filename: json.data.filename, fileType: json.data.fileType, fileSize: json.data.fileSize };
    };

    // Ek hi saath 10+ photos par kuch upload timeout/5xx/429 se fail ho jaate the. Transient error par
    // backoff ke saath 3 baar try karo, aur ek upload ko 100s se zyada atakne mat do (queue slot na ruke).
    // Transient = retry ke layak: network/timeout, HTTP 408/425/429/5xx (apiService ab `status` deta hai — pehle sirf error
    // message ke text se andaza lagta tha, isliye S3/"Server error" jaise 5xx bina retry ke seedha fail dikhte the).
    const isTransientStatus = (st) => st === 408 || st === 425 || st === 429 || (st >= 500 && st <= 599);
    const isTransientUploadError = (e) => e?.isNetworkFailure || isTransientStatus(e?.status)
        || /too many|slow down|timeout|timed out|temporar|unavailable|gateway|network|try again/i.test(String(e?.message ?? ""));
    const uploadWithRetry = async (localUri, mimeType, messageType, fileName, onProgress) => {
        let lastErr;
        for (let attempt = 0; attempt < 4; attempt += 1) {
            try {
                let timer;
                const timeout = new Promise((_, rej) => {
                    timer = setTimeout(() => { const err = new Error("Upload timed out"); err.isNetworkFailure = true; rej(err); }, 100000);
                });
                try {
                    return await Promise.race([uploadMedia(localUri, mimeType, messageType, fileName, { onProgress }), timeout]);
                } finally { clearTimeout(timer); }
            } catch (e) {
                lastErr = e;
                if (!isTransientUploadError(e) || attempt === 3) break;
                // Backoff + jitter (429 par server ko saans), 1.5s, 3s, 4.5s
                await new Promise((r) => setTimeout(r, 1500 * (attempt + 1) + Math.random() * 500));
            }
        }
        throw lastErr;
    };

    // Client-side unique id — backend `clientMessageId` (partial unique index per
    // sender) retry ko idempotent/duplicate-safe banata hai: same id dobara
    // bhejo to naya message nahi banta, jo pehle bana tha wahi wapas aata hai.
    const genClientMessageId = () => `cmid_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

    // Step 2: POST /messages. Server socket + push se deliver karta hai.
    // existingTempId milne par (retry/offline-queue-sweep) wahi bubble+SQL row
    // reuse hota hai, naya nahi banta — warna purana queued row SQL me orphan reh jaata.
    const sendMessage = async ({ content = "", messageType = "text", uploadedData = null, replyTo = replyMsg, clientMessageId = null, existingTempId = null }) => {
        if (messageType === "text" && !content.trim()) return;
        if (messageType !== "text" && !uploadedData) return;
        if (isBlocked) { askUnblock(); return; }
        if (isLockedForMe || isOtherDeleted) return;
        closeSearch();
        const tempId = existingTempId || `temp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        const cmid = clientMessageId || genClientMessageId();
        const baseMsg = existingTempId ? messagesRef.current.find((m) => m._id === tempId) : null;
        const optimisticMsg = {
            _id: tempId, clientMessageId: cmid, content, messageType, chat: chatId,
            sender: { _id: MY_USER_ID, name: maniAllData?.user?.name ?? "You" },
            status: "sending", isOptimistic: true, readBy: [], deliveredTo: [],
            createdAt: baseMsg?.createdAt || new Date().toISOString(),
            attachments: uploadedData ? [uploadedData] : [],
            ...(replyTo ? { replyTo } : {}),
        };
        if (existingTempId) {
            setMessages((prev) => prev.map((m) => (m._id === tempId ? optimisticMsg : m)));
        } else {
            setMessages((prev) => [optimisticMsg, ...prev]);
        }
        setInputText(""); setReplyMsg(null); setShowEmoji(false); setSending(true);
        try {
            const payload = {
                chatId, content, messageType, clientMessageId: cmid,
                ...(replyTo?._id ? { replyTo: replyTo._id } : {}),
                ...(uploadedData ? { attachments: [{ url: uploadedData.url, filename: uploadedData.filename, fileType: uploadedData.fileType, fileSize: uploadedData.fileSize }] } : {}),
            };
            if (isBroadcast && broadcastIds.length) {
                // clientMessageId sirf sender+id par unique hai (chat-independent) — same id
                // N chats ko bhejte to 2nd se pichli chats "duplicate" samajh li jaati aur
                // unmein message banta hi nahi. Har target chat ko apna derived id do.
                await Promise.all(broadcastIds.map((id) => apiService({ method: "POST", endpoint: "messages", data: { ...payload, chatId: id, clientMessageId: `${cmid}_${id}` } })));
                setMessages((prev) => prev.filter((m) => m._id !== tempId));
            } else {
                const res = await apiService({ method: "POST", endpoint: "messages", data: payload, timeout: 60000 });
                if (res?.success && res?.data?.message) {
                    const sent = res.data.message;
                    // Jawab aane se pehle ✓✓ / blue ✓✓ aa chuka ho to wahi lagao
                    const early = pendingReceipts.current[sent?._id];
                    delete pendingReceipts.current[sent?._id];
                    const status = early ?? determineStatus(sent);
                    // Socket ne ye message pehle hi daal diya ho to temp wala hata do, warna replace
                    setMessages((prev) => prev.some((m) => m._id === sent?._id)
                        ? prev.filter((m) => m._id !== tempId)
                        : prev.map((m) => m._id === tempId ? { ...sent, status, isOptimistic: false } : m));
                    // Sirf confirmed server copy cache karo — temp/optimistic wala nahi
                    cacheMessages(chatId, [sent]);
                    // `new-message` emit NAHI karna — server pehle hi deliver kar chuka (API doc rule 5)
                    // Chat list me bhi turant last message + top par. Nayi chat ho
                    // (list me abhi nahi) to header ki info se row ban jayegi.
                    dispatch(updateChatLastMessage({
                        msg: { ...sent, chat: sent?.chat ?? chatId },
                        myUserId: MY_USER_ID,
                        chat: {
                            _id: chatId,
                            isGroupChat: isGroup,
                            displayName: chatName || "TeleBook User",
                            displayAvatar: chatImage || DEFAULT_AVATAR,
                            displayUser: isGroup ? null : { _id: otherUserId, name: otherChatUser?.name, mobile: otherChatUser?.mobile },
                            users: [],
                        },
                    }));
                    dispatch(persistChatTabs());
                } else {
                    // Request server tak pahunchi aur usne mana kiya (block/locked/validation) —
                    // res.error TAB bhi ek object hota hai (error.response.data). Internet/server
                    // tak pahunchi hi nahi (timeout, DNS, offline) — apiService error.message ek
                    // plain string deta hai. Isi se "offline queue" vs "real rejection" decide hota hai.
                    const isNetworkFailure = typeof res?.error === "string" || isTransientStatus(res?.status);
                    handleSendFailure(tempId, optimisticMsg, isNetworkFailure, apiErrorMessage(res, "Send failed"));
                }
            }
        } catch (e) {
            handleSendFailure(tempId, optimisticMsg, false, e?.message);
        } finally {
            setSending(false);
            stopTyping();
        }
    };

    // Ek jagah se failure handle karo — text aur media dono send paths isi ko bulate hain.
    // Network failure (internet nahi / server tak request pahuchi hi nahi) ho to message
    // SQL me "queued" maarke rakh do — connectivity wapas aate hi khud retry ho jaayega
    // (retryQueuedMessages, neeche). Server ne khud mana kiya ho (blocked/locked/validation)
    // to sirf "failed" dikhao, auto-retry mat karo — wahi behavior jo pehle tha.
    const handleSendFailure = (tempId, optimisticMsg, isNetworkFailure, errorMessage) => {
        const patch = { status: "failed", ...(isNetworkFailure ? { offlineQueued: true } : {}) };
        setMessages((prev) => prev.map((m) => (m._id === tempId ? { ...m, ...patch } : m)));
        if (isNetworkFailure) {
            cacheMessages(chatId, [{ ...optimisticMsg, ...patch }]);
        } else if (errorMessage && errorMessage !== "Send failed") {
            Alert.alert("Message not sent", errorMessage);
        }
    };

    // PUT /messages/:id { content } — sirf apna text message. Server room ko `message-edited` bhejta hai.
    const startEdit = (msg) => {
        setReplyMsg(null);
        setEditMsg(msg);
        setInputText(msg?.content ?? "");
    };
    const cancelEdit = () => { setEditMsg(null); setInputText(""); };
    const saveEdit = async (text) => {
        const msg = editMsg;
        const content = text.trim();
        if (!msg?._id || !content) return;
        setEditMsg(null); setInputText(""); stopTyping();
        if (content === msg.content) return;
        const before = { content: msg.content, isEdited: msg.isEdited, editedAt: msg.editedAt };
        const editedAt = new Date().toISOString();
        setMessages((prev) => prev.map((m) => (m._id === msg._id ? { ...m, content, isEdited: true, editedAt } : m)));
        const res = await apiService({ method: "PUT", endpoint: `messages/${msg._id}`, data: { content } });
        if (!res?.success) {
            setMessages((prev) => prev.map((m) => (m._id === msg._id ? { ...m, ...before } : m)));
            Alert.alert("Error", windowErrorMessage(res) ?? apiErrorMessage(res, "Could not edit message"));
            return;
        }
        // Server ne updated message object nahi lautaya is endpoint par — jo
        // optimistically state me daala wahi (confirmed) version cache karo
        cacheMessages(chatId, [{ ...msg, content, isEdited: true, editedAt }]);
    };
    // Input ka send: edit chal raha ho to save, warna naya message (stickers hamesha naya)
    const submitFromInput = (args) => (editMsg && args?.messageType === "text" ? saveEdit(args.content) : sendMessage(args));

    // ── Non-blocking media upload queue ────────────────────────────────────────
    //
    //  Pehle: har file ka upload `uploading=true` ke peeche pura screen block
    //  karta tha (Modal), ek-ek file sequentially. Ab: har asset ke liye turant
    //  ek optimistic bubble (local preview) list me aa jaata hai, upload
    //  background me, max MAX_CONCURRENT_UPLOADS files parallel (memory/network
    //  overload na ho), composer/list hamesha interactive rehte hain.
    // Queue + pending bubbles ab services/pendingMedia.js me hain (module-level), isliye
    // Back dabane par bhi upload chalta rehta hai aur wapas aane par progress dikhta hai (Point 10).
    const cancelledUploadsRef = useRef(cancelledUploads); // module-level: tempId -> true (soft-cancel flag, checked after upload resolves)

    // Store ke events (progress, resolve, failure) is screen ki list me lagao; mount par
    // jo pending items store me pehle se hain unhe bhi list me jodo.
    useEffect(() => {
        const pend = getPending(chatId);
        if (pend.length) {
            setMessages((prev) => {
                const ids = new Set(pend.map((p) => p._id));
                return [...pend, ...prev.filter((m) => !ids.has(m._id))].sort(byNewest);
            });
        }
        return subscribePending(chatId, (ev) => setMessages((prev) => applyPendingEvent(prev, ev)));
    }, [chatId]);

    // Screen band hone par bhi chalne wale job ke liye: foreground me Alert, warna chhota Toast
    const notifySendError = (text) => {
        if (!text) return;
        if (isFocusedRef.current) Alert.alert("Message not sent", text);
        else Toast.show({ type: "error", text1: "Message not sent", text2: text });
    };

    // asset: {uri, mimeType|type, fileName|name}. existingTempId/clientMessageId
    // milne par (retry) wahi bubble reuse hota hai, naya nahi banta.
    const sendMediaAsset = (asset, messageType, replyTo = null, existingTempId = null, existingClientMessageId = null) => {
        const tempId = existingTempId || `temp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        const clientMessageId = existingClientMessageId || genClientMessageId();
        const localUri = asset.uri;
        const mimeType = asset.mimeType || {
            video: "video/mp4", image: "image/jpeg", audio: "audio/mp4",
        }[messageType] || "application/octet-stream";
        const fileName = asset.fileName || asset.name;
        // Retry me upload pehle ho chuka ho (sirf POST /messages fail hua tha) to dobara upload nahi
        const uploaded = asset.uploaded || null;
        const content = messageType === "document" ? (fileName || "") : "";

        // Retry par purana createdAt (list me position) preserve karo — naya nahi.
        // Store pehle: screen band ho to messagesRef purana/khali hota hai, createdAt (list ki jagah) na badle
        const baseMsg = existingTempId
            ? (getPending(chatId).find((m) => m._id === tempId) ?? messagesRef.current.find((m) => m._id === tempId))
            : null;
        const optimisticMsg = {
            _id: tempId, clientMessageId, content, messageType, chat: chatId,
            sender: { _id: MY_USER_ID, name: maniAllData?.user?.name ?? "You" },
            status: "sending", uploadProgress: 0,
            isOptimistic: true, readBy: [], deliveredTo: [],
            createdAt: baseMsg?.createdAt || new Date().toISOString(),
            attachments: [uploaded ?? { url: localUri, filename: fileName, fileType: mimeType, _pendingUpload: true }],
            ...(replyTo ? { replyTo } : {}),
        };

        // offlineQueued (retry par) optimisticMsg me nahi hai, isliye purana flag bhi saaf ho jata hai —
        // jab tak dobara fail na ho, "queued" sweep isse skip karega.
        upsertPending(chatId, { ...optimisticMsg, offlineQueued: false });

        enqueueUpload(chatId, async () => {
            try {
                // Progress har tick par patch karne se poori list re-render hoti thi (10 images = flicker).
                // Sirf 10% ke step par patch karo.
                let lastPct = -10;
                const up = uploaded ?? await uploadWithRetry(localUri, mimeType, messageType, fileName, (pct) => {
                    if (pct >= 100 || pct - lastPct >= 10) { lastPct = pct; patchPending(chatId, tempId, { uploadProgress: pct }); }
                });
                // Upload complete hone ke BAAD check karo — cancel mid-flight nahi roka
                // (RN par axios abort signal upload hi tod deta tha), par agar user ne
                // tap kiya tha, uploaded file ko bhi message nahi banana.
                if (cancelledUploadsRef.current[tempId]) {
                    removePending(chatId, tempId);
                    uncacheMessage(chatId, tempId);
                    return;
                }
                const realAttachment = { url: up.url, filename: up.filename, fileType: up.fileType, fileSize: up.fileSize };
                // Apni image dobara download na ho / placeholder flash na aaye: local file ko server url ke naam se cache karo
                if (!uploaded && ["image", "video", "audio", "document"].includes(messageType)) seedMediaCache(getFullUrl(up.url), localUri);
                patchPending(chatId, tempId, { attachments: [realAttachment], uploadProgress: 100 });

                const payload = {
                    chatId, content, messageType, clientMessageId,
                    ...(replyTo?._id ? { replyTo: replyTo._id } : {}),
                    attachments: [realAttachment],
                };

                if (isBroadcast && broadcastIds.length) {
                    // clientMessageId sender+id par unique hai (chat-independent) — har target
                    // chat ko apna derived id do, warna 2nd+ chats "duplicate" maani jaati hain.
                    await Promise.all(broadcastIds.map((id) =>
                        apiService({ method: "POST", endpoint: "messages", data: { ...payload, chatId: id, clientMessageId: `${clientMessageId}_${id}` } })));
                    removePending(chatId, tempId);
                    return;
                }

                const res = await apiService({ method: "POST", endpoint: "messages", data: payload, timeout: 60000 });
                if (res?.success && res?.data?.message) {
                    const sent = res.data.message;
                    const early = pendingReceipts.current[sent?._id];
                    delete pendingReceipts.current[sent?._id];
                    const status = early ?? determineStatus(sent);
                    // Sirf server se confirm hone ke baad hi Sent/Delivered status (Point 15)
                    unregisterRetry(chatId, tempId);
                    resolvePending(chatId, tempId, { ...sent, status, isOptimistic: false });
                    cacheMessages(chatId, [sent]);
                    // Pehle failed/queued ban kar SQL me gayi temp row hatao, warna reopen par duplicate/galat order
                    uncacheMessage(chatId, tempId);
                    dispatch(updateChatLastMessage({
                        msg: { ...sent, chat: sent?.chat ?? chatId },
                        myUserId: MY_USER_ID,
                        chat: {
                            _id: chatId, isGroupChat: isGroup,
                            displayName: chatName || "TeleBook User",
                            displayAvatar: chatImage || DEFAULT_AVATAR,
                            displayUser: isGroup ? null : { _id: otherUserId, name: otherChatUser?.name, mobile: otherChatUser?.mobile },
                            users: [],
                        },
                    }));
                    dispatch(persistChatTabs());
                } else {
                    // Upload ho chuka tha, sirf POST /messages fail hua — cache me real
                    // (uploaded) attachment hi jaaye, warna retry use dobara upload kar dega.
                    const isNetworkFailure = typeof res?.error === "string" || isTransientStatus(res?.status);
                    failPendingMedia(tempId, { ...optimisticMsg, attachments: [realAttachment] }, isNetworkFailure, apiErrorMessage(res, "Send failed"));
                }
            } catch (e) {
                // uploadMedia khud fail hua (ya koi aur anjaan error) — attachment abhi
                // bhi local file hai, isliye optimisticMsg (_pendingUpload:true) hi cache ho.
                failPendingMedia(tempId, optimisticMsg, isTransientUploadError(e), e?.message);
            } finally {
                delete cancelledUploadsRef.current[tempId];
            }
        });

        return tempId;
    };

    // True network-abort nahi karta (RN par wahi upload tod deta tha) — bas flag
    // on karta hai aur bubble turant hata deta hai; background upload chalta
    // reh sakta hai par result discard ho jaata hai (dekhen sendMediaAsset).
    const cancelUpload = (tempId) => {
        cancelledUploadsRef.current[tempId] = true;
        unregisterRetry(chatId, tempId);
        removePending(chatId, tempId);
        uncacheMessage(chatId, tempId);
    };

    // Network-fail media ko screen/focus ke bina bhi khud retry karo (backoff ke saath) —
    // pehle sirf socket reconnect / foreground / Chat-open par retry hota tha, isliye
    // "Waiting for network" par atka rehta tha (Point 12). Manual/sweep retry aa chuka ho to skip.
    const scheduleAutoRetry = (tempId) => {
        const n = autoRetryAttempts.get(tempId) ?? 0;
        if (n >= AUTO_RETRY_DELAYS.length) return;
        autoRetryAttempts.set(tempId, n + 1);
        setTimeout(() => {
            const cur = getPending(chatId).find((p) => p._id === tempId);
            if (!cur || cur.status !== "failed" || !cur.offlineQueued) return;
            retryMessage(cur);
        }, AUTO_RETRY_DELAYS[n]);
    };

    // Media send fail: store me status "failed" (Retry button dikhe), network fail ho to SQL me queued
    const failPendingMedia = (tempId, optimisticMsg, isNetworkFailure, errorMessage) => {
        const patch = { status: "failed", uploadProgress: undefined, ...(isNetworkFailure ? { offlineQueued: true } : {}) };
        patchPending(chatId, tempId, patch);
        if (isNetworkFailure) {
            cacheMessages(chatId, [{ ...optimisticMsg, ...patch }]);
            scheduleAutoRetry(tempId);
            // Socket reconnect / app foreground par bhi turant resume (pendingMedia.resumeQueuedUploads)
            registerRetry(chatId, tempId, () => {
                const cur = getPending(chatId).find((p) => p._id === tempId);
                if (cur) retryMessage(cur);
            });
        } else if (errorMessage && errorMessage !== "Send failed") notifySendError(errorMessage);
    };

    // Failed message dobara bhejo. Agar upload khud fail hua tha (attachment
    // abhi bhi local file hai — _pendingUpload), same tempId/clientMessageId
    // reuse karke dobara upload+send karo. Warna (upload ho gaya tha, sirf
    // POST /messages fail hua) purana flow — attachment wahi rehta hai.
    const retryMessage = (m) => {
        const att = m.attachments?.[0];
        if (m.messageType !== "text" && att) {
            // Media: upload baaki (_pendingUpload) ho to dobara upload, warna sirf POST /messages.
            // Dono rasta store se chalte hain, isliye screen band hone par bhi kaam karte hain.
            sendMediaAsset(
                { uri: att.url, mimeType: att.fileType, fileName: att.filename, uploaded: att._pendingUpload ? null : att },
                m.messageType, m.replyTo ?? null, m._id, m.clientMessageId
            );
            return;
        }
        sendMessage({
            content: m.content, messageType: m.messageType, uploadedData: att ?? null,
            replyTo: m.replyTo ?? null, clientMessageId: m.clientMessageId, existingTempId: m._id,
        });
    };

    // Offline-queue sweep: jo messages network na hone ki wajah se fail ho kar
    // SQL me "queued" ho gaye the (offlineQueued:true), unhe yahan se dobara try
    // karte hain — koi manual tap nahi chahiye. Trigger points: AppState
    // foreground, socket reconnect, aur har successful fetchMessages/refreshLatest
    // (jo khud proof hai ki connectivity wapas aa gayi hai) — yeh sab ek hi
    // "reconnect moment" par ek saath bhi fire ho sakte hain. messagesRef sirf
    // last render tak update hota hai, isliye ek chhota in-memory guard taaki
    // ek hi burst me same message do/teen baar retry na ho (clientMessageId
    // dedup se duplicate MESSAGE to nahi banta, par upload bewajah dobara hota).
    const retryingIdsRef = useRef(new Set());
    const retryQueuedMessages = useCallback(() => {
        const queued = messagesRef.current.filter(
            (m) => m.offlineQueued && m.status === "failed" && !retryingIdsRef.current.has(m._id)
        );
        queued.forEach((m) => {
            retryingIdsRef.current.add(m._id);
            retryMessage(m);
            setTimeout(() => retryingIdsRef.current.delete(m._id), 15000);
        });
    }, []);
    const retryQueuedRef = useRef(null);
    retryQueuedRef.current = retryQueuedMessages;

    // Apna in-app camera (neeche daayen Gallery button ke saath). expo-camera native module
    // build me na ho (purana APK / OTA) to purane system camera par wapas.
    const [CameraComp, setCameraComp] = useState(null);
    const [showCamera, setShowCamera] = useState(false);
    const openSystemCamera = async () => {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== "granted") return Alert.alert("Permission chahiye", "Camera allow karo");
        const res = await launchCameraAsync({ mediaTypes: ["images", "videos"], quality: 0.8 });
        if (!res.canceled) {
            const a = res.assets[0], isVid = a.type === "video";
            sendMediaAsset(a, isVid ? "video" : "image", replyMsg);
            setReplyMsg(null);
        }
    };
    const openCamera = async () => {
        setShowAttach(false);
        let Comp = CameraComp;
        if (!Comp) {
            try { Comp = require("./components/InAppCamera").default; setCameraComp(() => Comp); }
            catch (e) { console.log("expo-camera unavailable, system camera:", e?.message); return openSystemCamera(); }
        }
        setShowCamera(true);
    };
    const onCameraCaptured = (a) => {
        setShowCamera(false);
        sendMediaAsset(a, a.type === "video" ? "video" : "image", replyMsg);
        setReplyMsg(null);
    };

    const openGallery = async () => {
        setShowAttach(false);
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== "granted") return Alert.alert("Permission chahiye", "Gallery allow karo");
        const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images", "videos"], allowsMultipleSelection: true, selectionLimit: 10, quality: 0.8 });
        if (!res.canceled) {
            // Har asset turant apna optimistic bubble le leta hai aur background
            // queue me chala jaata hai — list/composer kisi ke liye wait nahi karte.
            // Reply sirf pehli item par (jaisa pehle tha).
            let replyTo = replyMsg;
            res.assets.forEach((a) => {
                const isVid = a.type === "video";
                sendMediaAsset(a, isVid ? "video" : "image", replyTo);
                replyTo = null;
            });
            setReplyMsg(null);
        }
    };

    const openDocument = async () => {
        setShowAttach(false);
        const res = await DocumentPicker.getDocumentAsync({ type: "*/*", copyToCacheDirectory: true });
        if (!res.canceled && res.assets?.length) {
            sendMediaAsset(res.assets[0], "document", replyMsg);
            setReplyMsg(null);
        }
    };

    const openVideoGallery = async () => {
        setShowAttach(false);
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== "granted") return Alert.alert("Permission chahiye", "Gallery allow karo");
        const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["videos"], allowsMultipleSelection: false, quality: 1 });
        if (!res.canceled) {
            sendMediaAsset(res.assets[0], "video", replyMsg);
            setReplyMsg(null);
        }
    };

    // Mic par tap → recording shuru; bar ka Send / Cancel se khatam.
    // (Pehle hold-to-record tha: permission dialog ya jaldi chhodne par recording
    // band hi nahi hoti thi, ya dobara tap par do recorder ban jate the.)
    const recordingBusy = useRef(false);
    const recordStartedAt = useRef(0);
    const startRecording = async () => {
        setShowAttach(false);
        if (isBlocked) { askUnblock(); return; }
        if (recordingBusy.current || isRecording) return;
        recordingBusy.current = true;
        try {
            const { status } = await requestRecordingPermissionsAsync();
            if (status !== "granted") { Alert.alert("Permission chahiye", "Mic allow karo"); return; }
            stopPlayback(); // koi voice note baj raha ho to record se pehle band karo
            await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
            await audioRecorder.prepareToRecordAsync();
            audioRecorder.record();
        } catch (e) {
            console.log("Recording start error:", e);
            Alert.alert("Error", "Recording shuru nahi ho saki");
            return;
        } finally {
            recordingBusy.current = false;
        }
        recordStartedAt.current = Date.now();
        setIsRecording(true); setRecordSecs(0);
        recordTimer.current = setInterval(() => setRecordSecs((s) => s + 1), 1000);
        Animated.loop(Animated.sequence([
            Animated.timing(scaleAnim, { toValue: 1.3, duration: 500, useNativeDriver: true }),
            Animated.timing(scaleAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
        ])).start();
    };

    const stopRecording = async () => {
        clearInterval(recordTimer.current); scaleAnim.stopAnimation(); scaleAnim.setValue(1); setIsRecording(false);
        if (!audioRecorder.isRecording) return;
        try { await audioRecorder.stop(); } catch (e) { console.log("Recording stop error:", e); }
        const uri = audioRecorder.uri;
        setRecordSecs(0);
        await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
        // 1 second se chhoti recording galti se tap hoti hai — mat bhejo
        if (!uri || Date.now() - recordStartedAt.current < 1000) return;
        sendMediaAsset({ uri, mimeType: "audio/mp4", fileName: `audio_${Date.now()}.m4a` }, "audio", replyMsg);
        setReplyMsg(null);
    };

    const cancelRecording = async () => {
        clearInterval(recordTimer.current); scaleAnim.stopAnimation(); scaleAnim.setValue(1);
        setIsRecording(false);
        if (audioRecorder.isRecording) await audioRecorder.stop();
        setRecordSecs(0);
        await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
    };

    const openPopup = (item, anchor = null) => {
        if (item.isDeleted) return;
        if (item.status === "failed") {
            Alert.alert("Message not sent", "", [
                { text: "Cancel", style: "cancel" },
                { text: "Delete", style: "destructive", onPress: () => { removePending(chatId, item._id); uncacheMessage(chatId, item._id); setMessages((prev) => prev.filter((m) => m._id !== item._id)); } },
                { text: "Retry", onPress: () => retryMessage(item) },
            ]);
            return;
        }
        if (item.isOptimistic) return;
        setPopupAnchor(anchor); setSelectedMsg(item); setShowPopup(true);
    };
    const closePopup = () => { setShowPopup(false); setSelectedMsg(null); setPopupAnchor(null); };
    const handleReply = () => { setReplyMsg(selectedMsg); closePopup(); };
    const handleDelete = () => {
        const id = selectedMsg?._id;
        closePopup();
        Alert.alert("Delete message", "This will delete the message only for you.", [
            { text: "Cancel", style: "cancel" },
            { text: "Delete for me", style: "destructive", onPress: () => deleteMessage(id, false) },
        ]);
    };
    const handleDeleteAll = () => {
        const id = selectedMsg?._id;
        closePopup();
        Alert.alert("Delete for everyone", "This will delete the message for everyone in this chat.", [
            { text: "Cancel", style: "cancel" },
            { text: "Delete", style: "destructive", onPress: () => deleteMessage(id, true) },
        ]);
    };
    const handleEdit = () => {
        const msg = selectedMsg; closePopup();
        if (!msg) return;
        if (isEditWindowExpired(msg)) { Toast.show({ type: "error", text1: "This message is too old to edit" }); return; }
        startEdit(msg);
    };
    const handleReact = (emoji) => { const msg = selectedMsg; closePopup(); reactToMessage(msg, emoji); };
    const handleCopy = () => {
        const text = selectedMsg?.content;
        closePopup();
        if (!text) return;
        const Clipboard = require("@react-native-clipboard/clipboard").default;
        Clipboard.setString(text);
    };
    const handleStartSelect = () => { const msg = selectedMsg; closePopup(); if (msg) handleSelectMsg(msg); };
    const handleForward = () => { setForwardMsgIds([selectedMsg?._id]); closePopup(); setShowForward(true); };
    const handleForwardSelected = () => { if (selectedMsgIds.size === 0) return; setForwardMsgIds([...selectedMsgIds]); setShowForward(true); };

    // POST /messages/forward { messageIds, chatIds } — dono real arrays
    const doForward = async (chatIds) => {
        setShowForward(false);
        // Server par jo order hai (purana pehle) usi order me forward karo
        const order = new Map(messages.map((m, i) => [m._id, i]));
        const deletedIds = new Set(messages.filter((m) => m.isDeleted || m.isOptimistic).map((m) => m._id));
        const messageIds = forwardMsgIds
            .filter((id) => id && !String(id).startsWith("temp_") && !deletedIds.has(id))
            .sort((a, b) => (order.get(b) ?? 0) - (order.get(a) ?? 0));
        if (!messageIds.length || !chatIds?.length) { cancelSelectMode(); return; }
        try {
            const res = await apiService({ method: "POST", endpoint: "messages/forward", data: { messageIds, chatIds } });
            if (!res?.success) throw new Error(apiErrorMessage(res, "Forward failed"));
            // Sender ko khud socket event nahi aata — isi chat me forward kiya ho to yahin dikhao
            const here = (res.data?.messages ?? []).filter((m) => idOf(m.chat) === chatId);
            if (here.length) {
                setMessages((prev) => {
                    const seen = new Set(prev.map((m) => m._id));
                    const fresh = here.filter((m) => !seen.has(m._id)).map((m) => ({ ...m, status: "sent" })).reverse();
                    return [...fresh, ...prev];
                });
            }
            // Target chats turant list ke top par (recent position) — server sync ka wait nahi.
            // Messages chat-by-chat order me aate hain, isliye aakhri target sabse upar rehta hai.
            (res.data?.messages ?? []).forEach((m) => {
                dispatch(updateChatLastMessage({ msg: { ...m, chat: idOf(m.chat) }, myUserId: MY_USER_ID }));
            });
            dispatch(persistChatTabs());
            // Baaki details (aur jo chat list me nahi thi) server se
            syncAllTabData(dispatch, MY_USER_ID, { background: true });
            // Blocking Alert ki jagah non-blocking toast (bahut items forward karne par popup nahi atkenge)
            Toast.show({ type: "success", text1: "Forwarded", text2: `${messageIds.length > 1 ? messageIds.length + " messages" : "Message"} sent to ${chatIds.length} chat${chatIds.length > 1 ? "s" : ""}`, visibilityTime: 1800 });
        } catch (e) { Alert.alert("Forward failed", e.message); }
        finally { cancelSelectMode(); }
    };

    // PUT /users/block/:id  |  PUT /users/unblock/:id
    const toggleBlock = async (userId, block) => {
        const res = await setBlocked(dispatch, userId, block);
        if (!res.ok) Alert.alert("Error", res.message);
    };

    // 1:1 chat se voice/video call lagana — POST /api/calls, InCall par navigate
    // karna, aur 402/409/403/503 jaisi known errors ka Toast sab callHelpers mein hai.
    const handleVoiceCall = () => {
        if (isGroup || !otherUserId) return;
        startCall({ navigation, calleeId: otherUserId, type: "audio", remoteUser: { _id: otherUserId, name: chatName, profilePicture: chatImage } });
    };
    const handleVideoCall = () => {
        if (isGroup || !otherUserId) return;
        startCall({ navigation, calleeId: otherUserId, type: "video", remoteUser: { _id: otherUserId, name: chatName, profilePicture: chatImage } });
    };

    const askUnblock = () => {
        Alert.alert("Unblock", `Unblock ${chatName || "this contact"} to send messages?`, [
            { text: "Cancel", style: "cancel" },
            { text: "Unblock", onPress: () => toggleBlock(otherUserId, false) },
        ]);
    };

    const confirmBlock = (userId, name) => {
        if (!userId) return;
        if (blockedIds.includes(userId)) {
            Alert.alert("Unblock", `Unblock ${name || "this user"}?`, [
                { text: "Cancel", style: "cancel" },
                { text: "Unblock", onPress: () => toggleBlock(userId, false) },
            ]);
            return;
        }
        Alert.alert("Block User", `Block ${name || "this user"}? They won't be able to send you messages.`, [
            { text: "Cancel", style: "cancel" },
            { text: "Block", style: "destructive", onPress: () => toggleBlock(userId, true) },
        ]);
    };

    const handleBlock = () => {
        const sender = selectedMsg?.sender;
        closePopup();
        confirmBlock(idOf(sender), sender?.name);
    };

    const deleteMessage = async (msgId, forEveryone = false) => {
        if (!msgId) return;
        const ids = Array.isArray(msgId) ? msgId : [msgId];
        // Abhi bheje ja rahe (temp) messages server par hain hi nahi
        const serverIds = ids.filter((id) => id && !String(id).startsWith("temp_"));
        try {
            if (forEveryone) {
                // DELETE /messages { messageIds: [...] } — ek hi call me saare
                const res = await apiService({ method: "DELETE", endpoint: "messages", data: { messageIds: serverIds } });
                // 403 DELETE_WINDOW_EXPIRED: UI optimistic nahi tha, isliye kuch rollback nahi — message visible rehta hai
                if (!res?.success) throw new Error(windowErrorMessage(res) ?? apiErrorMessage(res));
                // Dusron ke / window ke bahar ke message server skip karta hai (skippedMessageIds) — wo visible rahte hain
                const skipped = new Set((res.data?.skippedMessageIds ?? []).map(String));
                const deleted = (res.data?.deletedMessageIds ?? serverIds).map(String).filter((id) => !skipped.has(id));
                if (skipped.size) Toast.show({ type: "info", text1: "Some messages could not be deleted for everyone" });
                const deletedSet = new Set(deleted);
                setMessages((prev) => prev.map((m) =>
                    deletedSet.has(String(m._id))
                        ? { ...m, isDeleted: true, content: 'This message was deleted', attachments: [] }
                        : m
                ));
                // Memory + SQL cache me bhi delete reflect karo — server ne jitne ids lautaye SAB (jo abhi `messages` state me
                // nahi, sirf SQLite me hain unko bhi), attachments saaf aur local media-cache files bhi hat jati hain.
                // (Tombstone ke karan koi in-flight purana sync batch inhe wapas zinda nahi karega.)
                await markMessagesDeleted(chatId, deleted);
            } else {
                // DELETE /messages/delete-for-me { messageIds } — sirf mere liye
                if (serverIds.length) {
                    const res = await apiService({ method: "DELETE", endpoint: "messages/delete-for-me", data: { messageIds: serverIds } });
                    if (!res?.success) throw new Error(apiErrorMessage(res));
                }
                setMessages((prev) => prev.filter((m) => !ids.includes(m._id)));
                // Local DB (SQL + memory) se bhi hatao — pehle sirf screen state se jata tha, cache me bacha rehta
                // tha aur app band-khol par dikh kar phir gayab hota (blink)
                removeMessagesLocally(chatId, ids);
            }
            // Chat list ka last-message preview bhi theek ho (background, loader nahi)
            if (MY_USER_ID) syncAllTabData(dispatch, MY_USER_ID, { background: true });
        } catch (e) { Alert.alert("Error", e?.message || "Could not delete the message. Please try again."); }
    };

    const handleSelectMsg = (item, anchor = null) => {
        // Deleted / abhi-bhejte (temp_) message select nahi hote
        if (!item?._id || item.isDeleted || item.isOptimistic || String(item._id).startsWith("temp_")) return;
        if (anchor) {
            setSelAnchor({ ...anchor, id: item._id });
            // Reaction bar root View ke andar absolute hai — window coords ko root ke origin se relative karne ke liye
            rootRef.current?.measureInWindow?.((rx, ry) => { if (Number.isFinite(ry)) rootYRef.current = ry; });
        }
        setIsSelectMode(true);
        setSelectedMsgIds((prev) => {
            const next = new Set(prev);
            if (next.has(item._id)) next.delete(item._id); else next.add(item._id);
            if (next.size === 0) setIsSelectMode(false);
            return next;
        });
    };

    const handleSaveContact = async () => {
        const mobile = otherChatUser?.mobile;
        if (!mobile) return;
        const r = await saveUnknownContact({ mobile, dispatch });
        if (r === "denied") Toast.show({ type: "error", text1: "Contacts permission is needed" });
        else if (r === "saved") Toast.show({ type: "success", text1: "Contact saved" });
        else if (r === "exists") Toast.show({ type: "info", text1: "Contact already saved" });
        else if (r === "error") Toast.show({ type: "error", text1: "Could not save contact" });
    };

    const cancelSelectMode = () => { setIsSelectMode(false); setSelectedMsgIds(new Set()); };

    const isSelectable = (m) => !!m?._id && !m.isDeleted && !m.isOptimistic && !String(m._id).startsWith("temp_");
    const handleReplySelected = () => {
        if (selectedMsgIds.size !== 1) return;
        const msg = messages.find((m) => selectedMsgIds.has(m._id));
        cancelSelectMode();
        if (msg) setReplyMsg(msg);
    };
    // Ek message select ho to poora popup (react, edit, block...) kholo
    const handleMoreSelected = () => {
        if (selectedMsgIds.size !== 1) return;
        const msg = messages.find((m) => selectedMsgIds.has(m._id));
        cancelSelectMode();
        if (msg) { setPopupAnchor(selAnchor?.id === msg._id ? selAnchor : null); setSelectedMsg(msg); setShowPopup(true); }
    };
    const handleSelectAll = () => {
        setSelectedMsgIds(new Set(messages.filter(isSelectable).map((m) => m._id)));
        setIsSelectMode(true);
    };

    const handleCopySelected = () => {
        if (selectedMsgIds.size === 0) return;
        const Clipboard = require("@react-native-clipboard/clipboard").default;
        const selectedTexts = messages.filter((m) => selectedMsgIds.has(m._id) && m.messageType === "text" && !m.isDeleted && m.content).map((m) => m.content).join("\n");
        if (!selectedTexts) { Alert.alert("Copy", "Selected messages mein copy karne ke liye koi text nahi hai."); return; }
        Clipboard.setString(selectedTexts);
        Alert.alert("✓ Copied", `${selectedMsgIds.size} message${selectedMsgIds.size > 1 ? "s" : ""} copy ho gaya`);
        cancelSelectMode();
    };

    const deleteSelectedMessages = () => {
        if (selectedMsgIds.size === 0) return;
        const ids = [...selectedMsgIds];
        const allMine = ids.every((id) => {
            const msg = messages.find((m) => m._id === id);
            return msg?.sender?._id === MY_USER_ID || msg?.sender === MY_USER_ID;
        });
        const buttons = [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete for Me', style: 'destructive',
                onPress: async () => { await deleteMessage(ids, false); cancelSelectMode(); },
            },
        ];
        // Group owner/admin kisi ka bhi message sabke liye hata sakta hai (time-window nahi lagti)
        const adminMod = isGroup && isGroupAdmin;
        // Broadcast se aaye message sabke liye delete nahi hote (server bhi 403 deta hai)
        const hasBroadcast = ids.some((id) => messages.find((m) => m._id === id)?.isBroadcast);
        const allExpired = !adminMod && ids.every((id) => isDeleteWindowExpired(messages.find((m) => m._id === id)));
        const canEveryone = (allMine || adminMod) && !allExpired && !hasBroadcast;
        if (canEveryone) {
            buttons.push({
                text: 'Delete for Everyone', style: 'destructive',
                onPress: async () => { await deleteMessage(ids, true); cancelSelectMode(); },
            });
        }
        Alert.alert(
            'Delete Messages',
            `Delete ${ids.length} message${ids.length > 1 ? 's' : ''}?\n\nDelete for Me removes ${ids.length > 1 ? 'them' : 'it'} only from your own view.${canEveryone ? ' Delete for Everyone removes ' + (ids.length > 1 ? 'them' : 'it') + ' for everyone in this chat.' : ''}`,
            buttons
        );
    };

    // Same emoji dobara → reaction hatao (DELETE), warna PUT. Phir socket `message-reaction`
    // taaki dusron ki screen par live dikhe (API doc 6.4).
    const reactToMessage = async (msg, emoji) => {
        const msgId = msg?._id;
        if (!msgId) return;
        const mine = (msg.reactions ?? []).find((r) => idOf(r.user ?? r.userId) === MY_USER_ID);
        const removing = mine?.emoji === emoji;
        const before = msg.reactions ?? [];
        setMessages((prev) => prev.map((m) => (m._id === msgId ? withReaction(m, MY_USER_ID, removing ? null : emoji) : m)));
        const res = removing
            ? await apiService({ method: "DELETE", endpoint: `messages/${msgId}/react` })
            : await apiService({ method: "PUT", endpoint: `messages/${msgId}/react`, data: { emoji } });
        if (!res?.success) {
            setMessages((prev) => prev.map((m) => (m._id === msgId ? { ...m, reactions: before } : m)));
            return;
        }
        if (!removing && res.data?.reactions) {
            setMessages((prev) => prev.map((m) => (m._id === msgId ? { ...m, reactions: res.data.reactions } : m)));
        }
        socketService.emit("message-reaction", { messageId: msgId, chatId, emoji: removing ? "" : emoji });
    };

    // Reaction chip tap (MessageBubble sirf meri apni chip par call karta hai) — same emoji = hata do
    const handleReactionPress = (msg, emoji) => reactToMessage(msg, emoji);

    const openDocInBrowser = async (url) => {
        const fullUrl = getFullUrl(url);
        // canOpenURL Android 11+ par https ke liye bhi false deta hai (manifest queries ke bina) —
        // seedha kholo, fail ho tab error
        try { await Linking.openURL(fullUrl); }
        catch { Alert.alert("Error", "File open nahi ho sakti"); }
    };

    // Download ho chuki local file ko system viewer se kholo (offline bhi chalta hai)
    const openLocalDoc = async (localUri, att) => {
        try {
            const Sharing = require("expo-sharing");
            if (await Sharing.isAvailableAsync()) {
                await Sharing.shareAsync(localUri, { mimeType: att?.fileType, dialogTitle: att?.filename || "Open file" });
                return;
            }
        } catch (e) { /* neeche fallback */ }
        try { await Linking.openURL(localUri); }
        catch { Alert.alert("Error", "File open nahi ho sakti"); }
    };

    const gotouserDetails = () => navigation.navigate(isGroup ? "Group" : "ChatUserDetailScreen", { chatId });

    // ── Search match helpers ──────────────────────────────────────
    const activeMatchId = currentMatchIndex >= 0 ? searchMatchIds[currentMatchIndex] : null;
    const matchIdSet = useMemo(() => new Set(searchMatchIds), [searchMatchIds]);

    // ── Chat background image ─────────────────────────────────────
    const bgImage = isDark ? Images.ChatblackBackground : Images.ChatwhiteBackground;

    // Root ka background theme ka (pehle hamesha #000): chat area aur input ke beech fractional-pixel gap me yeh jhalakta tha —
    // light theme me input ke upar 1px kaali line dikhti thi.
    return (
        <View ref={rootRef} collapsable={false} style={[styles.container, { backgroundColor: theme?.background ?? (isDark ? '#000' : '#fff') }]}>
            <StatusBar backgroundColor={theme?.header ?? "#1296f3"} barStyle="light-content" />

            <ChatHeader
                navigation={navigation}
                chatName={chatName}
                chatImage={hideCounterpart ? DEFAULT_AVATAR : chatImage}
                isGroup={isGroup}
                isBroadcast={isBroadcast}
                chatDaetils={chatDaetils}
                isTyping={hideCounterpart ? false : isTyping}
                isOnline={hideCounterpart ? false : isOnline}
                hidePresence={hideCounterpart}
                gotouserDetails={gotouserDetails}
                isSelectMode={isSelectMode}
                selectedCount={selectedMsgIds.size}
                onCancelSelect={cancelSelectMode}
                onForwardSelected={handleForwardSelected}
                onDeleteSelected={deleteSelectedMessages}
                onCopySelected={handleCopySelected}
                onReplySelected={handleReplySelected}
                onMoreSelected={handleMoreSelected}
                onSelectAll={handleSelectAll}
                MY_USER_ID={MY_USER_ID}
                fmtTime={fmtTime}
                isSearchMode={isSearchMode}
                searchText={searchText}
                onSearchChange={onSearchChange}
                onOpenSearch={openSearch}
                onCloseSearch={closeSearch}
                onClearChat={clearChat}
                getFullUrl={getFullUrl}
                isBlocked={isBlocked}
                onSaveContact={!isGroup && !isBroadcast && otherChatUser?.mobile ? handleSaveContact : null}
                onToggleBlock={!isGroup && otherUserId ? () => confirmBlock(otherUserId, chatName) : null}
                onVoiceCall={handleVoiceCall}
                onVideoCall={handleVideoCall}
                callsAvailable={getCachedCallsConfig()?.available === true}
            />

            {isSelectMode && selectedMsgIds.size === 1 && (() => {
                const only = messages.find((m) => selectedMsgIds.has(m._id));
                if (!only || only.isDeleted) return null;
                const mineEmoji = (only.reactions ?? []).find((r) => idOf(r?.user ?? r?.userId) === MY_USER_ID)?.emoji;
                // Pressed message ke upar (jagah na ho to neeche) — header ke neeche / keyboard ke upar clamp; anchor na ho to beech me
                const winH = Dimensions.get("window").height;
                const BAR_H = 56, GAP = 8;
                const minTop = insets.top + 64;
                const maxTop = Math.max(minTop, winH - keyboardH - BAR_H - 90);
                let winTop = (winH - BAR_H) / 2;
                if (selAnchor?.id === only._id) {
                    const above = selAnchor.y - BAR_H - GAP;
                    winTop = above >= minTop ? above : selAnchor.y + selAnchor.h + GAP;
                }
                const barTop = Math.max(minTop, Math.min(maxTop, winTop)) - rootYRef.current - 6;
                return (
                    <ReactionBar
                        top={barTop}
                        isDark={isDark}
                        mine={mineEmoji}
                        onReact={(emoji) => { cancelSelectMode(); reactToMessage(only, emoji); }}
                    />
                );
            })()}

            {/* 🔎 Search match navigation bar (VS Code jaisa "X of Y" + up/down) */}
            {isSearchMode && searchText.trim().length >= 2 && (
                <SearchNavBar
                    isSearching={isSearching}
                    current={currentMatchIndex}
                    total={searchMatchIds.length}
                    onPrev={prevMatch}
                    onNext={nextMatch}
                    theme={theme}
                />
            )}

            {/* Android par edge-to-edge on hai (window resize nahi hoti), isliye dono
                platform par "padding" — keyboard ke upar input bilkul chipak kar aata hai */}
            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior="padding"
                keyboardVerticalOffset={0}
            >
                <ImageBackground source={bgImage} style={[styles.chatBg, theme?.chatTint && { backgroundColor: theme.chatTint }]} imageStyle={theme?.chatTint ? { opacity: 0.35 } : undefined} resizeMode="cover">
                    {/* Search me bhi actual chat hi dikhti hai — matches inline highlight + scroll hote hain */}
                    <MessageList
                        key="chat"
                        flatRef={flatRef}
                        messages={messages}
                        loading={loading}
                        cacheReady={cacheReady}
                        MY_USER_ID={MY_USER_ID}
                        isGroup={isGroup}
                        isBroadcast={isBroadcast}
                        theme={theme}
                        getFullUrl={getFullUrl}
                        setImageModalUri={setImageModalUri}
                        setVideoModalUri={setVideoModalUri}
                        openPopup={openPopup}
                        openDocInBrowser={openDocInBrowser}
                        openLocalDoc={openLocalDoc}
                        retryMessage={retryMessage}
                        onCancelUpload={cancelUpload}
                        setReplyMsg={setReplyMsg}
                        setShowEmoji={setShowEmoji}
                        fmtTime={fmtTime}
                        isSelectMode={isSelectMode}
                        selectedMsgIds={selectedMsgIds}
                        onSelectMsg={handleSelectMsg}
                        onReactionPress={handleReactionPress}
                        onCancelSelect={cancelSelectMode}
                        onDeleteSelected={deleteSelectedMessages}
                        onForwardSelected={handleForwardSelected}
                        onCopySelected={handleCopySelected}
                        hasMore={!historyComplete}
                        loadingMore={backfilling && !historyComplete}
                        onLoadMore={loadMoreMessages}
                        /* 🔎 search-nav props */
                        activeSearchId={activeMatchId}
                        searchScrollNonce={searchScrollNonce}
                        matchIdSet={matchIdSet}
                    />
                </ImageBackground>

                {!isSelectMode && isBlocked && (
                    <TouchableOpacity
                        style={[styles.blockedBar, { backgroundColor: theme?.background ?? '#fff', paddingBottom: 14 + insets.bottom }]}
                        onPress={askUnblock}
                        activeOpacity={0.8}
                    >
                        <Text style={[styles.blockedText, { color: theme?.text ?? '#333' }]}>
                            You blocked this contact. <Text style={[styles.blockedLink, { color: theme?.main ?? '#1296f3' }]}>Tap to unblock.</Text>
                        </Text>
                    </TouchableOpacity>
                )}

                {!isSelectMode && !isBlocked && (isLockedForMe || isOtherDeleted) && (
                    <View style={[styles.blockedBar, { backgroundColor: theme?.background ?? '#fff', paddingBottom: 14 + insets.bottom }]}>
                        <Text style={[styles.blockedText, { color: theme?.text ?? '#333' }]}>
                            {isOtherDeleted ? "This account has been deleted." : "Only admins can send messages."}
                        </Text>
                    </View>
                )}

                {!isSelectMode && !isBlocked && !isLockedForMe && !isOtherDeleted && (
                    <TextInputSection
                        inputText={inputText}
                        handleTyping={handleTyping}
                        showEmoji={showEmoji}
                        setShowEmoji={setShowEmoji}
                        keyboardH={keyboardH}
                        bottomInset={keyboardH > 0 ? 0 : insets.bottom}
                        sending={sending}
                        sendMessage={submitFromInput}
                        editMsg={editMsg}
                        onCancelEdit={cancelEdit}
                        isRecording={isRecording}
                        startRecording={startRecording}
                        stopRecording={stopRecording}
                        cancelRecording={cancelRecording}
                        replyMsg={replyMsg}
                        setReplyMsg={setReplyMsg}
                        recordSecs={recordSecs}
                        scaleAnim={scaleAnim}
                        fmtSecs={fmtSecs}
                        setShowAttach={setShowAttach}
                        theme={theme}
                        openCamera={openCamera}
                    />
                )}

                {!!CameraComp && (
                    <CameraComp
                        visible={showCamera}
                        onClose={() => setShowCamera(false)}
                        onCaptured={onCameraCaptured}
                        onOpenGallery={() => { setShowCamera(false); setTimeout(openGallery, 350); }}
                    />
                )}


                <AttachSheet
                    visible={showAttach}
                    onClose={() => setShowAttach(false)}
                    openCamera={openCamera}
                    openGallery={openGallery}
                    openDocument={openDocument}
                    openVideoGallery={openVideoGallery}
                />

                <MessagePopup
                    visible={showPopup}
                    message={selectedMsg}
                    isMine={selectedMsg?.sender?._id === MY_USER_ID || selectedMsg?.sender === MY_USER_ID}
                    onClose={closePopup}
                    onReply={handleReply}
                    onDelete={handleDelete}
                    onDeleteForAll={handleDeleteAll}
                    onEdit={handleEdit}
                    anchor={popupAnchor}
                    canEdit={!isEditWindowExpired(selectedMsg)}
                    canModerate={isGroup && isGroupAdmin && !(selectedMsg?.sender?._id === MY_USER_ID || selectedMsg?.sender === MY_USER_ID)}
                    canDeleteForAll={!selectedMsg?.isBroadcast && ((isGroup && isGroupAdmin) || !isDeleteWindowExpired(selectedMsg))}
                    onForward={handleForward}
                    onReact={handleReact}
                    onBlock={handleBlock}
                    onCopy={handleCopy}
                    onSelect={handleStartSelect}
                    isStarred={!!selectedMsg?.starredBy?.some((u) => idOf(u) === MY_USER_ID)}
                    isSenderBlocked={blockedIds.includes(idOf(selectedMsg?.sender))}
                    theme={theme}
                />

                <ForwardContactModal
                    visible={showForward}
                    onClose={() => setShowForward(false)}
                    onForward={doForward}
                />

                <ImageViewer
                    visible={!!imageModalUri}
                    uri={imageModalUri}
                    onClose={() => setImageModalUri(null)}
                />
                <VideoModal
                    visible={!!videoModalUri}
                    uri={videoModalUri}
                    onClose={() => setVideoModalUri(null)}
                />
            </KeyboardAvoidingView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000', overflow: 'hidden' },
    chatBg: { flex: 1, width: '100%' },
    searchInfo: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
    searchInfoText: { color: "#999", fontSize: 14, textAlign: "center" },
    blockedBar: { paddingTop: 14, paddingHorizontal: 16, alignItems: 'center' },
    blockedText: { fontSize: 14, textAlign: 'center' },
    blockedLink: { color: '#1296f3', fontWeight: '600' },
});