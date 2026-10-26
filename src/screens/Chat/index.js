import {
    RecordingPresets,
    requestRecordingPermissionsAsync,
    setAudioModeAsync,
    useAudioRecorder,
} from "expo-audio";
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
    ImageBackground,
    Keyboard,
    KeyboardAvoidingView,
    Linking,
    Modal,
    Platform,
    SafeAreaView,
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
import { loadCachedMessages, cacheMessages, getMemoryMessages } from "../../services/messageSync";
import { markMessageDeletedLocally } from "../../services/messagesDb";
import Images from "../../utils/images";

import AttachSheet from "./components/AttachSheet";
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

const DEFAULT_AVATAR = "https://cdn-icons-png.flaticon.com/512/149/149071.png";
const DEFAULT_GRP_AVT = 'https://cdn-icons-png.flaticon.com/512/681/681494.png';

const idOf = (v) => v?._id ?? v;

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
    const [currentPage, setCurrentPage] = useState(1);
    const [hasMore, setHasMore] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const LIMIT = 50;
    const isBlocked = !isGroup && !!otherUserId && blockedIds.includes(otherUserId);
    // Locked group me sirf admin likh sakte hain (owner = groupAdmin, promoted = admins)
    const isGroupAdmin = [...(chatDaetils?.groupAdmin ?? []), ...(chatDaetils?.admins ?? [])].some((u) => idOf(u) === MY_USER_ID);
    const isLockedForMe = isGroup && !!chatDaetils?.isLocked && !isGroupAdmin;
    // Delete ho chuka account chat me "Deleted account" naam se rehta hai (API doc rule 13)
    const otherChatUser = !isGroup ? chatDaetils?.users?.find((u) => idOf(u) !== MY_USER_ID) : null;
    const isOtherDeleted = !!otherChatUser && (otherChatUser.isDeleted === true || otherChatUser.name === "Deleted account");

    const [isSearchMode, setIsSearchMode] = useState(false);
    const [searchText, setSearchText] = useState("");
    const [searchResults, setSearchResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    const [searchMatchIds, setSearchMatchIds] = useState([]);       // saare matched message ids
    const [currentMatchIndex, setCurrentMatchIndex] = useState(-1); // abhi konsa match active hai
    const [searchScrollNonce, setSearchScrollNonce] = useState(0);  // same id dobara tap ho to bhi re-trigger
    const searchTimer = useRef(null);

    const isPaginating = useRef(false);
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
        const onDeleted = ({ messageId }) => setMessages((prev) => prev.map((m) => m._id === messageId ? { ...m, isDeleted: true, content: "This message was deleted", attachments: [] } : m));
        const onBulkDeleted = ({ messageIds, chatId: deletedChatId }) => {
            if (deletedChatId && deletedChatId !== chatId) return;
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

    // Offline-first, race-free: pehle SQL cache ka wait karo (await — do alag
    // effects nahi, jisme fetchMessages() apna setLoading(true) cache resolve
    // hone se PEHLE hi chala deta tha, isliye spinner cache maujood hone ke
    // bawajood bhi har baar flash hota tha). Cache mila to turant dikhao aur
    // fetchMessages ko silent (bina spinner) background-sync ki tarah chalao;
    // cache khaali ho (sach me pehli baar ye chat khuli hai) tabhi spinner
    // genuinely zaroori hai.
    useEffect(() => {
        let cancelled = false;
        (async () => {
            const cached = await loadCachedMessages(chatId);
            if (cancelled) return;
            setCacheReady(true);
            if (cached.length) {
                setMessages((prev) => (prev.length ? prev : cached.map((m) => ({ ...m, status: determineStatus(m) }))));
                setLoading(false);
                fetchMessages({ silent: true });
            } else {
                fetchMessages({ silent: false });
            }
        })();
        return () => { cancelled = true; };
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
                    setchatName(otherUser?.name || "TeleBook User");
                    setchatImage(isEmpty(otherUser?.profilePicture) ? getFullUrl(otherUser?.profilePicture) : DEFAULT_AVATAR);
                }
            }
            setIsGroup(isGroup || !!res?.data?.isGroupChat || !!res?.data?.group);
            setIsBroadcast(chatData?.isBroadcast || false);
        } catch (e) { console.error("Chat details error:", e); }
    };

    // silent=true: cache se pehle hi kuch dikh chuka hai, isliye yahan background
    // sync hai — spinner ki zaroorat nahi (yehi asli fix hai cache-hone-ke-bawajood
    // har baar spinner flash hone ka).
    const fetchMessages = async ({ silent = false } = {}) => {
        try {
            if (!silent) setLoading(true);
            // GET khud saare messages read mark kar deta hai — alag se emit nahi karna (API doc 6.4)
            const res = await apiService({ method: "GET", endpoint: `messages/${chatId}?page=1&limit=${LIMIT}` });
            if (!res?.success) {
                // Offline ho aur cache se pehle hi kuch dikh raha ho to chup chaap rehne do
                // (WhatsApp jaisa) — alert sirf tab jab dikhane ko kuch bhi nahi hai.
                if (messagesRef.current.length === 0) {
                    Alert.alert("Error", apiErrorMessage(res, "Messages load nahi hue"));
                }
                return;
            }
            const details = res?.data?.chatDetails;
            setchatDaetils(details);
            if (details?.isGroupChat) setIsGroup(true);
            if (!details?.isGroupChat && !otherUserIdRef.current) {
                const other = details?.users?.find((u) => (u?._id ?? u) !== MY_USER_ID);
                if (other?._id) setOtherUserId(other._id);
            }
            const msgs = (res?.data?.messages ?? []).map((m) => ({ ...m, status: determineStatus(m) }));
            cacheMessages(chatId, msgs);
            // Server ko abhi tak pata hi nahi un messages ka jo offline/send-fail hue —
            // blind overwrite unhe gayab kar deta tha. Pending optimistic ones ko bachao.
            setMessages((prev) => {
                const freshIds = new Set(msgs.map((m) => m._id));
                const pending = prev.filter((m) => m.isOptimistic && !freshIds.has(m._id));
                return [...pending, ...msgs];
            });
            setCurrentPage(1);
            setHasMore(res?.data?.pagination?.hasMore ?? false);
            // Successful fetch khud proof hai ki connectivity hai — queued messages try karo.
            retryQueuedRef.current?.();
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    // Page 1 dobara laao aur jo list me hai usme mila do (naye messages + taaza ticks).
    // GET chat ko read bhi mark karta hai, isliye sirf tab chalao jab chat dikh rahi ho.
    const refreshLatest = async () => {
        const res = await apiService({ method: "GET", endpoint: `messages/${chatId}?page=1&limit=${LIMIT}` });
        if (!res?.success) return;
        const fresh = (res?.data?.messages ?? []).map((m) => ({ ...m, status: determineStatus(m) }));
        cacheMessages(chatId, fresh);
        if (res?.data?.chatDetails) setchatDaetils(res.data.chatDetails);
        setMessages((prev) => {
            const freshIds = new Set(fresh.map((m) => m._id));
            const oldest = fresh.length ? new Date(fresh[fresh.length - 1].createdAt).getTime() : Infinity;
            const pending = prev.filter((m) => m.isOptimistic);
            const older = prev.filter((m) => !m.isOptimistic && !freshIds.has(m._id) && new Date(m.createdAt).getTime() < oldest);
            return [...pending, ...fresh, ...older];
        });
        dispatch(clearUnread(chatId));
        // Successful fetch khud proof hai ki connectivity hai — queued messages try karo.
        retryQueuedRef.current?.();
    };
    const refreshLatestRef = useRef(null);
    refreshLatestRef.current = refreshLatest;

    const loadMoreMessages = async () => {
        if (loadingMore || !hasMore) return;
        try {
            setLoadingMore(true);
            isPaginating.current = true;
            const nextPage = currentPage + 1;
            const res = await apiService({ method: "GET", endpoint: `messages/${chatId}?page=${nextPage}&limit=${LIMIT}` });
            if (!res?.success) return;
            const olderMsgs = (res?.data?.messages ?? []).map((m) => ({ ...m, status: determineStatus(m) }));
            cacheMessages(chatId, olderMsgs);
            // Beech me aaye naye message ki wajah se page shift ho to duplicate na bane
            setMessages((prev) => {
                const seen = new Set(prev.map((m) => m._id));
                return [...prev, ...olderMsgs.filter((m) => !seen.has(m._id))];
            });
            setCurrentPage(nextPage);
            setHasMore(res?.data?.pagination?.hasMore ?? false);
        } catch (e) { console.error("Load more error:", e); }
        finally { setLoadingMore(false); setTimeout(() => { isPaginating.current = false; }, 300); }
    };

    const determineStatus = (m) => {
        if (m.readBy?.length) return "read";
        if (m.deliveredTo?.length) return "delivered";
        return "sent";
    };

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
                        setMessages([]); setHasMore(false); setCurrentPage(1);
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
            throw err;
        }
        return { url: json.data.url, filename: json.data.filename, fileType: json.data.fileType, fileSize: json.data.fileSize };
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
                const res = await apiService({ method: "POST", endpoint: "messages", data: payload });
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
                            displayUser: isGroup ? null : { _id: otherUserId, name: chatName },
                            users: [],
                        },
                    }));
                    dispatch(persistChatTabs());
                } else {
                    // Request server tak pahunchi aur usne mana kiya (block/locked/validation) —
                    // res.error TAB bhi ek object hota hai (error.response.data). Internet/server
                    // tak pahunchi hi nahi (timeout, DNS, offline) — apiService error.message ek
                    // plain string deta hai. Isi se "offline queue" vs "real rejection" decide hota hai.
                    const isNetworkFailure = typeof res?.error === "string";
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
    const MAX_CONCURRENT_UPLOADS = 3;
    const uploadQueueRef = useRef([]);
    const activeUploadsRef = useRef(0);
    const cancelledUploadsRef = useRef({}); // tempId -> true (soft-cancel flag, checked after upload resolves)

    const runNextUpload = useCallback(() => {
        if (activeUploadsRef.current >= MAX_CONCURRENT_UPLOADS) return;
        const job = uploadQueueRef.current.shift();
        if (!job) return;
        activeUploadsRef.current += 1;
        job().finally(() => {
            activeUploadsRef.current -= 1;
            runNextUpload();
        });
        runNextUpload(); // dusra free slot bhi try karo
    }, []);

    const enqueueUpload = useCallback((job) => {
        uploadQueueRef.current.push(job);
        runNextUpload();
    }, [runNextUpload]);

    const updateMsgById = useCallback((id, patch) => {
        setMessages((prev) => prev.map((m) => (m._id === id ? { ...m, ...patch } : m)));
    }, []);

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
        const content = messageType === "document" ? (fileName || "") : "";

        // Retry par purana createdAt (list me position) preserve karo — naya nahi.
        const baseMsg = existingTempId ? messagesRef.current.find((m) => m._id === tempId) : null;
        const optimisticMsg = {
            _id: tempId, clientMessageId, content, messageType, chat: chatId,
            sender: { _id: MY_USER_ID, name: maniAllData?.user?.name ?? "You" },
            status: "sending", uploadProgress: 0,
            isOptimistic: true, readBy: [], deliveredTo: [],
            createdAt: baseMsg?.createdAt || new Date().toISOString(),
            attachments: [{ url: localUri, filename: fileName, fileType: mimeType, _pendingUpload: true }],
            ...(replyTo ? { replyTo } : {}),
        };

        if (existingTempId) {
            // offlineQueued hata do — jab tak dobara fail na ho, "queued" sweep isse skip kare
            updateMsgById(tempId, { status: "sending", uploadProgress: 0, offlineQueued: false });
        } else {
            setMessages((prev) => [optimisticMsg, ...prev]);
        }

        enqueueUpload(async () => {
            try {
                const up = await uploadMedia(localUri, mimeType, messageType, fileName, {
                    onProgress: (pct) => updateMsgById(tempId, { uploadProgress: pct }),
                });
                // Upload complete hone ke BAAD check karo — cancel mid-flight nahi roka
                // (RN par axios abort signal upload hi tod deta tha), par agar user ne
                // tap kiya tha, uploaded file ko bhi message nahi banana.
                if (cancelledUploadsRef.current[tempId]) {
                    setMessages((prev) => prev.filter((m) => m._id !== tempId));
                    return;
                }
                const realAttachment = { url: up.url, filename: up.filename, fileType: up.fileType, fileSize: up.fileSize };
                updateMsgById(tempId, { attachments: [realAttachment], uploadProgress: 100 });

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
                    setMessages((prev) => prev.filter((m) => m._id !== tempId));
                    return;
                }

                const res = await apiService({ method: "POST", endpoint: "messages", data: payload });
                if (res?.success && res?.data?.message) {
                    const sent = res.data.message;
                    const early = pendingReceipts.current[sent?._id];
                    delete pendingReceipts.current[sent?._id];
                    const status = early ?? determineStatus(sent);
                    setMessages((prev) => prev.some((m) => m._id === sent?._id)
                        ? prev.filter((m) => m._id !== tempId)
                        : prev.map((m) => m._id === tempId ? { ...sent, status, isOptimistic: false } : m));
                    cacheMessages(chatId, [sent]);
                    dispatch(updateChatLastMessage({
                        msg: { ...sent, chat: sent?.chat ?? chatId },
                        myUserId: MY_USER_ID,
                        chat: {
                            _id: chatId, isGroupChat: isGroup,
                            displayName: chatName || "TeleBook User",
                            displayAvatar: chatImage || DEFAULT_AVATAR,
                            displayUser: isGroup ? null : { _id: otherUserId, name: chatName },
                            users: [],
                        },
                    }));
                    dispatch(persistChatTabs());
                } else {
                    // Upload ho chuka tha, sirf POST /messages fail hua — cache me real
                    // (uploaded) attachment hi jaaye, warna retry use dobara upload kar dega.
                    const isNetworkFailure = typeof res?.error === "string";
                    handleSendFailure(tempId, { ...optimisticMsg, attachments: [realAttachment] }, isNetworkFailure, apiErrorMessage(res, "Send failed"));
                }
            } catch (e) {
                // uploadMedia khud fail hua (ya koi aur anjaan error) — attachment abhi
                // bhi local file hai, isliye optimisticMsg (_pendingUpload:true) hi cache ho.
                handleSendFailure(tempId, optimisticMsg, !!e?.isNetworkFailure, e?.message);
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
        setMessages((prev) => prev.filter((m) => m._id !== tempId));
    };

    // Failed message dobara bhejo. Agar upload khud fail hua tha (attachment
    // abhi bhi local file hai — _pendingUpload), same tempId/clientMessageId
    // reuse karke dobara upload+send karo. Warna (upload ho gaya tha, sirf
    // POST /messages fail hua) purana flow — attachment wahi rehta hai.
    const retryMessage = (m) => {
        const pendingAttachment = m.attachments?.[0];
        if (pendingAttachment?._pendingUpload) {
            sendMediaAsset(
                { uri: pendingAttachment.url, mimeType: pendingAttachment.fileType, fileName: pendingAttachment.filename },
                m.messageType, m.replyTo ?? null, m._id, m.clientMessageId
            );
            return;
        }
        sendMessage({
            content: m.content, messageType: m.messageType, uploadedData: m.attachments?.[0] ?? null,
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

    const openCamera = async () => {
        setShowAttach(false);
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== "granted") return Alert.alert("Permission chahiye", "Camera allow karo");
        const res = await ImagePicker.launchCameraAsync({ mediaTypes: ["images", "videos"], quality: 0.8 });
        if (!res.canceled) {
            const a = res.assets[0], isVid = a.type === "video";
            sendMediaAsset(a, isVid ? "video" : "image", replyMsg);
            setReplyMsg(null);
        }
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

    const openPopup = (item) => {
        if (item.isDeleted) return;
        if (item.status === "failed") {
            Alert.alert("Message not sent", "", [
                { text: "Cancel", style: "cancel" },
                { text: "Delete", style: "destructive", onPress: () => setMessages((prev) => prev.filter((m) => m._id !== item._id)) },
                { text: "Retry", onPress: () => retryMessage(item) },
            ]);
            return;
        }
        if (item.isOptimistic) return;
        setSelectedMsg(item); setShowPopup(true);
    };
    const closePopup = () => { setShowPopup(false); setSelectedMsg(null); };
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
    // PUT /messages/:id/star toggle hai. Optimistic update, fail ho to rollback; server ka
    // isStarred hi final. temp_/deleted messages par star nahi.
    const isStarredByMe = (m) => !!m?.starredBy?.some((u) => idOf(u) === MY_USER_ID);
    const starOne = async (msg) => {
        const msgId = msg?._id;
        if (!msgId || String(msgId).startsWith("temp_") || msg.isDeleted || msg.isOptimistic) return { ok: false, skipped: true };
        const before = isStarredByMe(msg);
        setMessages((prev) => prev.map((m) => (m._id === msgId ? withStar(m, MY_USER_ID, !before) : m)));
        const res = await apiService({ method: "PUT", endpoint: `messages/${msgId}/star` });
        if (!res?.success) {
            setMessages((prev) => prev.map((m) => (m._id === msgId ? withStar(m, MY_USER_ID, before) : m)));
            return { ok: false, message: apiErrorMessage(res, "Could not update star") };
        }
        const starred = !!res.data?.isStarred;
        setMessages((prev) => prev.map((m) => (m._id === msgId ? withStar(m, MY_USER_ID, starred) : m)));
        return { ok: true };
    };
    const handleStar = async () => {
        const msg = selectedMsg;
        closePopup();
        const r = await starOne(msg);
        if (r && !r.ok && !r.skipped) Alert.alert("Error", r.message);
    };
    // Multi-select: sirf selected ids. Sab pehle se starred ho to unstar, warna jo starred nahi unhe star.
    const handleStarSelected = async () => {
        if (selectedMsgIds.size === 0) return;
        const picked = messages.filter((m) => selectedMsgIds.has(m._id) && !m.isDeleted && !m.isOptimistic && !String(m._id).startsWith("temp_"));
        cancelSelectMode(); // stale selection har action ke baad saaf
        if (!picked.length) return;
        const allStarred = picked.every(isStarredByMe);
        const targets = allStarred ? picked : picked.filter((m) => !isStarredByMe(m));
        const results = await Promise.all(targets.map(starOne));
        const failed = results.filter((r) => !r.ok && !r.skipped).length;
        if (failed) Toast.show({ type: "error", text1: "Star failed", text2: `${failed} message${failed > 1 ? "s" : ""} could not be updated` });
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
            // Target chats ka last message list me aa jaye
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
                const deleted = (res.data?.deletedMessageIds ?? serverIds).filter((id) => !skipped.has(String(id)));
                if (skipped.size) Toast.show({ type: "info", text1: "Some messages could not be deleted for everyone" });
                setMessages((prev) => prev.map((m) =>
                    deleted.includes(m._id)
                        ? { ...m, isDeleted: true, content: 'This message was deleted', attachments: [] }
                        : m
                ));
                // SQL cache me bhi delete reflect karo — fire-and-forget, fail ho to bhi UI na tootey
                Promise.all(deleted.map((id) =>
                    markMessageDeletedLocally(chatId, id, { isDeleted: true, content: 'This message was deleted', attachments: [] })
                )).catch((e) => console.log('⚠️ markMessageDeletedLocally error:', e));
            } else {
                // DELETE /messages/delete-for-me { messageIds } — sirf mere liye
                if (serverIds.length) {
                    const res = await apiService({ method: "DELETE", endpoint: "messages/delete-for-me", data: { messageIds: serverIds } });
                    if (!res?.success) throw new Error(apiErrorMessage(res));
                }
                setMessages((prev) => prev.filter((m) => !ids.includes(m._id)));
            }
        } catch (e) { Alert.alert("Error", e?.message || "Could not delete the message. Please try again."); }
    };

    const handleSelectMsg = (item) => {
        // Deleted / abhi-bhejte (temp_) message select nahi hote
        if (!item?._id || item.isDeleted || item.isOptimistic || String(item._id).startsWith("temp_")) return;
        setIsSelectMode(true);
        setSelectedMsgIds((prev) => {
            const next = new Set(prev);
            if (next.has(item._id)) next.delete(item._id); else next.add(item._id);
            if (next.size === 0) setIsSelectMode(false);
            return next;
        });
    };

    const cancelSelectMode = () => { setIsSelectMode(false); setSelectedMsgIds(new Set()); };

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
        const allExpired = ids.every((id) => isDeleteWindowExpired(messages.find((m) => m._id === id)));
        if (allMine && !allExpired) {
            buttons.push({
                text: 'Delete for Everyone', style: 'destructive',
                onPress: async () => { await deleteMessage(ids, true); cancelSelectMode(); },
            });
        }
        Alert.alert(
            'Delete Messages',
            `Delete ${ids.length} message${ids.length > 1 ? 's' : ''}?\n\nDelete for Me removes ${ids.length > 1 ? 'them' : 'it'} only from your own view.${allMine && !allExpired ? ' Delete for Everyone removes ' + (ids.length > 1 ? 'them' : 'it') + ' for everyone in this chat.' : ''}`,
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

    const gotouserDetails = () => navigation.navigate(isGroup ? "Group" : "ChatUserDetailScreen", { chatId });

    // ── Search match helpers ──────────────────────────────────────
    const activeMatchId = currentMatchIndex >= 0 ? searchMatchIds[currentMatchIndex] : null;
    const matchIdSet = useMemo(() => new Set(searchMatchIds), [searchMatchIds]);

    // ── Chat background image ─────────────────────────────────────
    const bgImage = isDark ? Images.ChatblackBackground : Images.ChatwhiteBackground;

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar backgroundColor={theme?.header ?? "#1296f3"} barStyle="light-content" />

            <ChatHeader
                navigation={navigation}
                chatName={chatName}
                chatImage={chatImage}
                isGroup={isGroup}
                isBroadcast={isBroadcast}
                chatDaetils={chatDaetils}
                isTyping={isTyping}
                isOnline={isOnline}
                gotouserDetails={gotouserDetails}
                isSelectMode={isSelectMode}
                selectedCount={selectedMsgIds.size}
                onCancelSelect={cancelSelectMode}
                onForwardSelected={handleForwardSelected}
                onDeleteSelected={deleteSelectedMessages}
                onCopySelected={handleCopySelected}
                onStarSelected={handleStarSelected}
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
                onToggleBlock={!isGroup && otherUserId ? () => confirmBlock(otherUserId, chatName) : null}
                onVoiceCall={handleVoiceCall}
                onVideoCall={handleVideoCall}
                callsAvailable={getCachedCallsConfig()?.available === true}
            />

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
                <ImageBackground source={bgImage} style={styles.chatBg} resizeMode="cover">
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
                        hasMore={hasMore}
                        loadingMore={loadingMore}
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
                            You blocked this contact. <Text style={styles.blockedLink}>Tap to unblock.</Text>
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
                    canEdit={!isEditWindowExpired(selectedMsg)}
                    canDeleteForAll={!isDeleteWindowExpired(selectedMsg)}
                    onForward={handleForward}
                    onStar={handleStar}
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
        </SafeAreaView>
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