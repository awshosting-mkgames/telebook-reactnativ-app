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
import { loadCachedMessages, cacheMessages } from "../../services/messageSync";
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
const withReaction = (m, userId, emoji) => {
    const others = (m.reactions ?? []).filter((r) => idOf(r.user ?? r.userId) !== userId);
    return { ...m, reactions: emoji ? [...others, { user: userId, emoji }] : others };
};

export default function ChatScreen({ route, navigation }) {
    const { chatId, broadcastIds = [] } = route.params;
    const dispatch = useDispatch();
    const insets = useSafeAreaInsets();

    const { t } = useTranslation();
    const { theme } = useContext(ThemeContext);
    const isDark = theme?.text === '#FFFFFF';

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
    const [messages, setMessages] = useState([]);
    const [inputText, setInputText] = useState("");
    const [loading, setLoading] = useState(true);
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
    const [uploading, setUploading] = useState(false);
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

    const isFirstLoad = useRef(true);
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
                // Apna message server se wapas aaye ya same event do baar aaye to duplicate na bane
                setMessages((prev) => {
                    if (prev.some((m) => m._id === msg._id)) return prev;
                    // Socket message me replyTo kabhi sirf id hoti hai — list se poora message jodo
                    const replyTo = typeof msg.replyTo === "string"
                        ? prev.find((m) => m._id === msg.replyTo) ?? null
                        : msg.replyTo;
                    return [{ ...msg, replyTo, status: "delivered" }, ...prev];
                });
                cacheMessages(chatId, [msg]);
                if (senderId === MY_USER_ID) return;
                setIsTyping(false);
                // message-delivered socketService khud bhejta hai. Read sirf tab
                // jab chat sach me screen par dikh rahi ho (API doc section 7).
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
        // Reconnect (network wapas aaya) → agar chat abhi screen par hai to taaza kar lo.
        // refreshLatestRef se stale-closure bug nahi hota (AppState effect jaisa).
        const onConnect = () => { if (isFocusedRef.current) refreshLatestRef.current?.(); };
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

    // Offline-first: SQL cache se turant dikhao, blank screen na ho jab tak
    // network wait chale. fetchMessages() hi source-of-truth rehta hai —
    // yeh sirf "pehle kuch dikha do" hai. Race ho sakti hai (dono effects
    // saath chalte hain), isliye fetchMessages pehle hi kuch set kar chuka ho
    // to use clobber mat karo.
    useEffect(() => {
        (async () => {
            const cached = await loadCachedMessages(chatId);
            if (cached.length) {
                setMessages((prev) => (prev.length ? prev : cached.map((m) => ({ ...m, status: determineStatus(m) }))));
                setLoading(false);
            }
        })();
    }, [chatId]);

    useEffect(() => { fetchMessages(); }, []);
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

    const fetchMessages = async () => {
        try {
            setLoading(true);
            // GET khud saare messages read mark kar deta hai — alag se emit nahi karna (API doc 6.4)
            const res = await apiService({ method: "GET", endpoint: `messages/${chatId}?page=1&limit=${LIMIT}` });
            if (!res?.success) {
                Alert.alert("Error", apiErrorMessage(res, "Messages load nahi hue"));
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
            setMessages(msgs);
            cacheMessages(chatId, msgs);
            setCurrentPage(1);
            setHasMore(res?.data?.pagination?.hasMore ?? false);
            isFirstLoad.current = false;
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
    const uploadMedia = async (localUri, mimeType, messageType, fileName) => {
        const fromUri = localUri.split("?")[0].split("/").pop() ?? "";
        const ext = fromUri.includes(".") ? fromUri.split(".").pop() : (mimeType.split("/")[1] ?? "bin");
        const fd = new FormData();
        await appendFile(fd, "media", { uri: localUri, name: fileName || `${messageType}_${Date.now()}.${ext}`, type: mimeType });

        const res = await apiService({ method: "POST", endpoint: "users/media", data: fd, isMultipart: true });
        const json = res?.data;
        if (!res?.success || !json?.success) throw new Error(json?.message ?? res?.error?.message ?? "Media upload failed");
        return { url: json.data.url, filename: json.data.filename, fileType: json.data.fileType, fileSize: json.data.fileSize };
    };

    // Step 2: POST /messages. Server socket + push se deliver karta hai.
    const sendMessage = async ({ content = "", messageType = "text", uploadedData = null, replyTo = replyMsg }) => {
        if (messageType === "text" && !content.trim()) return;
        if (messageType !== "text" && !uploadedData) return;
        if (isBlocked) { askUnblock(); return; }
        if (isLockedForMe || isOtherDeleted) return;
        closeSearch();
        const tempId = `temp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        setMessages((prev) => [{
            _id: tempId, content, messageType, chat: chatId,
            sender: { _id: MY_USER_ID, name: maniAllData?.user?.name ?? "You" },
            status: "sending", isOptimistic: true, readBy: [], deliveredTo: [],
            createdAt: new Date().toISOString(),
            attachments: uploadedData ? [uploadedData] : [],
            ...(replyTo ? { replyTo } : {}),
        }, ...prev]);
        setInputText(""); setReplyMsg(null); setShowEmoji(false); setSending(true);
        try {
            const payload = {
                chatId, content, messageType,
                ...(replyTo?._id ? { replyTo: replyTo._id } : {}),
                ...(uploadedData ? { attachments: [{ url: uploadedData.url, filename: uploadedData.filename, fileType: uploadedData.fileType, fileSize: uploadedData.fileSize }] } : {}),
            };
            if (isBroadcast && broadcastIds.length) {
                await Promise.all(broadcastIds.map((id) => apiService({ method: "POST", endpoint: "messages", data: { ...payload, chatId: id } })));
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
                } else throw new Error(apiErrorMessage(res, "Send failed"));
            }
        } catch (e) {
            setMessages((prev) => prev.map((m) => m._id === tempId ? { ...m, status: "failed" } : m));
            // 403: blocked / deleted account / locked group — user ko batao
            if (e?.message && e.message !== "Send failed") Alert.alert("Message not sent", e.message);
        } finally {
            setSending(false);
            stopTyping();
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
            Alert.alert("Error", apiErrorMessage(res, "Message edit nahi hua"));
            return;
        }
        // Server ne updated message object nahi lautaya is endpoint par — jo
        // optimistically state me daala wahi (confirmed) version cache karo
        cacheMessages(chatId, [{ ...msg, content, isEdited: true, editedAt }]);
    };
    // Input ka send: edit chal raha ho to save, warna naya message (stickers hamesha naya)
    const submitFromInput = (args) => (editMsg && args?.messageType === "text" ? saveEdit(args.content) : sendMessage(args));

    // Failed message dobara bhejo — media ka upload pehle ho chuka hai, attachment wahi rehta hai
    const retryMessage = (m) => {
        setMessages((prev) => prev.filter((p) => p._id !== m._id));
        sendMessage({ content: m.content, messageType: m.messageType, uploadedData: m.attachments?.[0] ?? null, replyTo: m.replyTo ?? null });
    };

    const openCamera = async () => {
        setShowAttach(false);
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== "granted") return Alert.alert("Permission chahiye", "Camera allow karo");
        const res = await ImagePicker.launchCameraAsync({ mediaTypes: ["images", "videos"], quality: 0.8 });
        if (!res.canceled) {
            const a = res.assets[0], isVid = a.type === "video";
            try { setUploading(true); const up = await uploadMedia(a.uri, a.mimeType || (isVid ? "video/mp4" : "image/jpeg"), isVid ? "video" : "image", a.fileName); sendMessage({ content: "", messageType: isVid ? "video" : "image", uploadedData: up }); }
            catch (e) { Alert.alert("Upload failed", e.message); }
            finally { setUploading(false); }
        }
    };

    const openGallery = async () => {
        setShowAttach(false);
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== "granted") return Alert.alert("Permission chahiye", "Gallery allow karo");
        const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images", "videos"], allowsMultipleSelection: true, selectionLimit: 10, quality: 0.8 });
        if (!res.canceled) {
            // Reply sirf pehli photo par lage (baaki par purana replyMsg closure me reh jata tha)
            let replyTo = replyMsg;
            for (const a of res.assets) {
                const isVid = a.type === "video";
                try { setUploading(true); const up = await uploadMedia(a.uri, a.mimeType || (isVid ? "video/mp4" : "image/jpeg"), isVid ? "video" : "image", a.fileName); await sendMessage({ content: "", messageType: isVid ? "video" : "image", uploadedData: up, replyTo }); replyTo = null; }
                catch (e) { Alert.alert("Upload failed", e.message); }
                finally { setUploading(false); }
            }
        }
    };

    const openDocument = async () => {
        setShowAttach(false);
        const res = await DocumentPicker.getDocumentAsync({ type: "*/*", copyToCacheDirectory: true });
        if (!res.canceled && res.assets?.length) {
            const file = res.assets[0];
            try { setUploading(true); const up = await uploadMedia(file.uri, file.mimeType ?? "application/octet-stream", "document", file.name); sendMessage({ content: file.name, messageType: "document", uploadedData: up }); }
            catch (e) { Alert.alert("Document upload failed", e.message); }
            finally { setUploading(false); }
        }
    };

    const openVideoGallery = async () => {
        setShowAttach(false);
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== "granted") return Alert.alert("Permission chahiye", "Gallery allow karo");
        const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["videos"], allowsMultipleSelection: false, quality: 1 });
        if (!res.canceled) {
            const a = res.assets[0];
            try { setUploading(true); const up = await uploadMedia(a.uri, a.mimeType || "video/mp4", "video", a.fileName); sendMessage({ content: "", messageType: "video", uploadedData: up }); }
            catch (e) { Alert.alert("Video upload failed", e.message); }
            finally { setUploading(false); }
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
        try { setUploading(true); const up = await uploadMedia(uri, "audio/mp4", "audio", `audio_${Date.now()}.m4a`); sendMessage({ content: "", messageType: "audio", uploadedData: up }); }
        catch (e) { Alert.alert("Audio upload failed", e.message); }
        finally { setUploading(false); }
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
        Alert.alert("Delete message", "Ye message sirf aapke liye delete hoga.", [
            { text: "Cancel", style: "cancel" },
            { text: "Delete for me", style: "destructive", onPress: () => deleteMessage(id, false) },
        ]);
    };
    const handleDeleteAll = () => {
        const id = selectedMsg?._id;
        closePopup();
        Alert.alert("Delete for everyone", "Ye message sabke liye delete ho jayega.", [
            { text: "Cancel", style: "cancel" },
            { text: "Delete", style: "destructive", onPress: () => deleteMessage(id, true) },
        ]);
    };
    const handleEdit = () => { const msg = selectedMsg; closePopup(); if (msg) startEdit(msg); };
    // PUT /messages/:id/star toggle hai — response ka isStarred hi naya state
    const handleStar = async () => {
        const msg = selectedMsg;
        closePopup();
        if (!msg?._id) return;
        const res = await apiService({ method: "PUT", endpoint: `messages/${msg._id}/star` });
        if (!res?.success) { Alert.alert("Error", apiErrorMessage(res, "Star nahi hua")); return; }
        const starred = !!res.data?.isStarred;
        setMessages((prev) => prev.map((m) => {
            if (m._id !== msg._id) return m;
            const others = (m.starredBy ?? []).filter((u) => idOf(u) !== MY_USER_ID);
            return { ...m, starredBy: starred ? [...others, MY_USER_ID] : others };
        }));
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
            Alert.alert("✓ Forwarded", `${messageIds.length > 1 ? messageIds.length + " messages" : "Message"} sent to ${chatIds.length} chat${chatIds.length > 1 ? "s" : ""}`);
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
                if (!res?.success) throw new Error(apiErrorMessage(res));
                // Dusron ke message server skip karta hai — sirf jo sach me delete hue unhe mark karo
                const deleted = res.data?.deletedMessageIds ?? serverIds;
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
        } catch (e) { Alert.alert("Error", e?.message || "Message delete nahi hua, dobara try karo"); }
    };

    const handleSelectMsg = (item) => {
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
        if (allMine) {
            buttons.push({
                text: 'Delete for Everyone', style: 'destructive',
                onPress: async () => { await deleteMessage(ids, true); cancelSelectMode(); },
            });
        }
        Alert.alert(
            'Delete Messages',
            `${ids.length} message${ids.length > 1 ? 's' : ''} delete karo?`,
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
            <StatusBar backgroundColor="#1296f3" barStyle="light-content" />

            <ChatHeader
                navigation={navigation}
                chatName={chatName}
                chatImage={chatImage}
                isGroup={isGroup}
                isBroadcast={isBroadcast}
                chatDaetils={chatDaetils}
                isTyping={isTyping}
                isOnline={isOnline}
                uploading={uploading}
                gotouserDetails={gotouserDetails}
                isSelectMode={isSelectMode}
                selectedCount={selectedMsgIds.size}
                onCancelSelect={cancelSelectMode}
                onForwardSelected={handleForwardSelected}
                onDeleteSelected={deleteSelectedMessages}
                onCopySelected={handleCopySelected}
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
                        setReplyMsg={setReplyMsg}
                        setShowEmoji={setShowEmoji}
                        fmtTime={fmtTime}
                        isSelectMode={isSelectMode}
                        selectedMsgIds={selectedMsgIds}
                        onSelectMsg={handleSelectMsg}
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

                {/* Media upload hone tak blocking loader — isse double-send bhi ruk jata hai */}
                <Modal
                    visible={uploading}
                    transparent
                    animationType="fade"
                    statusBarTranslucent
                    onRequestClose={() => { }}
                >
                    <View style={styles.uploadOverlay}>
                        <View style={[styles.uploadCard, { backgroundColor: theme?.background ?? '#fff' }]}>
                            <ActivityIndicator size="large" color="#1296f3" />
                            <Text style={[styles.uploadCardText, { color: theme?.text ?? '#000' }]}>
                                {t('Uploading...')}
                            </Text>
                        </View>
                    </View>
                </Modal>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000', overflow: 'hidden' },
    chatBg: { flex: 1, width: '100%' },
    searchInfo: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
    searchInfoText: { color: "#999", fontSize: 14, textAlign: "center" },
    uploadOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center' },
    uploadCard: { minWidth: 160, paddingHorizontal: 28, paddingVertical: 24, borderRadius: 14, alignItems: 'center', gap: 14, elevation: 6 },
    uploadCardText: { fontSize: 15, fontWeight: '500' },
    blockedBar: { paddingTop: 14, paddingHorizontal: 16, alignItems: 'center' },
    blockedText: { fontSize: 14, textAlign: 'center' },
    blockedLink: { color: '#1296f3', fontWeight: '600' },
});