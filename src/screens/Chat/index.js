import {
    RecordingPresets,
    requestRecordingPermissionsAsync,
    setAudioModeAsync,
    useAudioRecorder,
} from "expo-audio";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { useContext, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
    ActivityIndicator,
    Alert,
    Animated,
    AppState,
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
    View,
} from "react-native";
import { useSelector } from "react-redux";
import { ThemeContext } from "../../components/ThemeContext";
import apiService from "../../services/apiService";
import Config from "../../services/config";
import socketService from "../../services/socketService";
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

const DEFAULT_AVATAR = "https://cdn-icons-png.flaticon.com/512/149/149071.png";
const DEFAULT_GRP_AVT = 'https://cdn-icons-png.flaticon.com/512/681/681494.png';

export default function ChatScreen({ route, navigation }) {
    const { chatId, broadcastIds = [] } = route.params;

    const { t } = useTranslation();
    const { theme } = useContext(ThemeContext);
    const isDark = theme?.text === '#FFFFFF';

    const maniAllData = useSelector((state) => state.totalappData);
    const MY_USER_ID = maniAllData?.userId ?? "";

    const [chatName, setchatName] = useState("");
    const [chatImage, setchatImage] = useState("");
    const [isGroup, setIsGroup] = useState(false);
    const [isBroadcast, setIsBroadcast] = useState(false);
    const [otherUserId, setOtherUserId] = useState(null);
    const [chatDaetils, setchatDaetils] = useState("");
    const [messages, setMessages] = useState([]);
    const [inputText, setInputText] = useState("");
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [isTyping, setIsTyping] = useState(false);
    const [replyMsg, setReplyMsg] = useState(null);
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

    useEffect(() => {
        const sub = AppState.addEventListener("change", (next) => {
            if (appState.current.match(/inactive|background/) && next === "active") {
                socketService.emit("get-user-status", { userId: otherUserId || chatId });
            }
            appState.current = next;
        });
        return () => sub.remove();
    }, []);

    useEffect(() => {
        socketService.joinChat(chatId);
        if (otherUserId || (!isGroup && chatId)) {
            socketService.emit("get-user-status", { userId: otherUserId || chatId });
        }
        const onMessageReceived = (msg) => {
            if (msg?.chat?._id === chatId) {
                setMessages((prev) => [{ ...msg, status: "delivered" }, ...prev]);
                socketService.emit("message-read", { messageId: msg._id, userId: MY_USER_ID, chatId });
                apiService({ method: "PUT", endpoint: `messages/${msg._id}/read` });
            }
        };
        const onStatusUpdate = ({ userId, status }) => { if (userId === otherUserId || userId === chatId) setIsOnline(status === "online"); };
        const onTyping = ({ chatId: c, userId }) => { if (c === chatId && userId !== MY_USER_ID) setIsTyping(true); };
        const onStopTyping = ({ chatId: c }) => { if (c === chatId) setIsTyping(false); };
        const onReadUpdate = ({ messageId }) => setMessages((prev) => prev.map((m) => m._id === messageId ? { ...m, status: "read", readBy: [{ _id: "read" }] } : m));
        const onDeliveredUpdate = ({ messageId }) => setMessages((prev) => prev.map((m) => m._id === messageId ? { ...m, status: "delivered", deliveredTo: [{ _id: "del" }] } : m));
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
            setMessages((prev) => prev.map((m) => {
                if (m._id !== messageId) return m;
                const reactions = [...(m.reactions ?? [])];
                const idx = reactions.findIndex((r) => r.userId === userId);
                if (idx >= 0) reactions[idx] = { userId, emoji };
                else reactions.push({ userId, emoji });
                return { ...m, reactions };
            }));
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
        socketService.on("user-online", (uid) => { if (uid === otherUserId || uid === chatId) setIsOnline(true); });
        socketService.on("user-offline", (uid) => { if (uid === otherUserId || uid === chatId) setIsOnline(false); });
        return () => {
            socketService.off("message-received");
            socketService.off("user-status-result");
            socketService.off("typing");
            socketService.off("stop-typing");
            socketService.off("message-read-update");
            socketService.off("message-delivered-update");
            socketService.off("message-deleted");
            socketService.off("messages-deleted");
            socketService.off("message-reaction-update");
            socketService.off("user-online");
            socketService.off("user-offline");
        };
    }, [chatId, MY_USER_ID]);

    useEffect(() => {
        fetchChatDetails();
        fetchMessages();
    }, []);
    const isEmpty = (value) => {
        if (value === null || value === undefined || value === '') {
            return false;
        }
        return true;
    };

    const fetchChatDetails = async () => {
        try {
            const res = await apiService({ method: "GET", endpoint: `chats/${chatId}/info` });
            setchatDaetils(res?.data);
            const chatData = res?.data?.chat;
            console.log("chatData________", res?.data)
            if (res?.data?.isGroupChat === true) {
                const grp = res?.data?.group;
                setOtherUserId(grp?._id);
                setchatName(grp?.chatName || "");
                setchatImage(isEmpty(grp?.groupIcon) ? getFullUrl(grp?.groupIcon) : DEFAULT_GRP_AVT);
            } else {
                const otherUser = chatData?.otherUser;
                if (otherUser?._id && otherUser?._id !== MY_USER_ID) {
                    setOtherUserId(otherUser?._id);
                    setchatName(otherUser?.name || "TeleBook User");
                    setchatImage(isEmpty(otherUser?.profilePicture) ? getFullUrl(otherUser?.profilePicture) : DEFAULT_AVATAR);
                }
            }
            setIsGroup(res?.data?.isGroupChat || false);
            setIsBroadcast(chatData?.isBroadcast || false);
        } catch (e) { console.error("Chat details error:", e); }
    };

    const fetchMessages = async () => {
        try {
            setLoading(true);
            const res = await apiService({ method: "GET", endpoint: `messages/${chatId}?page=1&limit=${LIMIT}` });
            setchatDaetils(res?.data?.chatDetails);
            const msgs = (res?.data?.messages ?? []).map((m) => ({ ...m, status: determineStatus(m) }));
            setMessages(msgs);
            setCurrentPage(1);
            setHasMore(res?.data?.pagination?.hasMore ?? false);
            isFirstLoad.current = false;
            msgs.forEach((m) => {
                const isMine = m.sender?._id === MY_USER_ID || m.sender === MY_USER_ID;
                const alreadyRead = m.readBy?.some((r) => r?.user?.toString() === MY_USER_ID || r?._id?.toString() === MY_USER_ID);
                if (!isMine && !alreadyRead) socketService.emit("message-read", { messageId: m._id, userId: MY_USER_ID, chatId });
            });
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    const loadMoreMessages = async () => {
        if (loadingMore || !hasMore) return;
        try {
            setLoadingMore(true);
            isPaginating.current = true;
            const nextPage = currentPage + 1;
            const res = await apiService({ method: "GET", endpoint: `messages/${chatId}?page=${nextPage}&limit=${LIMIT}` });
            const olderMsgs = (res?.data?.messages ?? []).map((m) => ({ ...m, status: determineStatus(m) }));
            setMessages((prev) => [...prev, ...olderMsgs]);
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
        if (q.length < 2) { setSearchResults([]); setSearchMatchIds([]); setCurrentMatchIndex(-1); setIsSearching(false); return; }
        setIsSearching(true);
        searchTimer.current = setTimeout(() => searchMessages(q), 400);
    };

    const searchMessages = async (query) => {
        try {
            setIsSearching(true);
            const res = await apiService({ method: "GET", endpoint: `messages/${chatId}?page=1&limit=${LIMIT}&search=${encodeURIComponent(query)}` });
            console.log("search_________res", res)
            setSearchResults((res?.data?.messages ?? []).map((m) => ({ ...m, status: determineStatus(m) })));

            // ── VS Code jaisa navigation: saare matched ids store karo aur pehle match par jump ──
            const ids = res?.data?.isSearchResult ? (res?.data?.matchedIds ?? []) : [];
            setSearchMatchIds(ids);
            setCurrentMatchIndex(ids.length ? 0 : -1);
            setSearchScrollNonce((n) => n + 1); // pehle match par auto-scroll
        } catch (e) {
            console.error("Search error:", e);
            setSearchResults([]); setSearchMatchIds([]); setCurrentMatchIndex(-1);
        } finally { setIsSearching(false); }
    };

    // index par jao (wrap-around), aur MessageList ko scroll ke liye trigger karo
    const jumpToMatch = (index) => {
        if (!searchMatchIds.length) return;
        const next = (index + searchMatchIds.length) % searchMatchIds.length;
        setCurrentMatchIndex(next);
        setSearchScrollNonce((n) => n + 1);
    };
    const nextMatch = () => jumpToMatch(currentMatchIndex + 1); // ↓ down arrow
    const prevMatch = () => jumpToMatch(currentMatchIndex - 1); // ↑ up arrow

    const openSearch = () => { setIsSearchMode(true); setSearchText(""); setSearchResults([]); setSearchMatchIds([]); setCurrentMatchIndex(-1); setIsSearching(false); };
    const closeSearch = () => { clearTimeout(searchTimer.current); setIsSearchMode(false); setSearchText(""); setSearchResults([]); setSearchMatchIds([]); setCurrentMatchIndex(-1); setIsSearching(false); };

    const clearChat = () => {
        Alert.alert("Clear chat", "Is chat ke saare messages clear kar dein?", [
            { text: "Cancel", style: "cancel" },
            {
                text: "Clear", style: "destructive", onPress: async () => {
                    try {
                        const res = await apiService({ method: "DELETE", endpoint: `chats/${chatId}/clear` });
                        if (res?.success !== false) { setMessages([]); setHasMore(false); setCurrentPage(1); }
                    } catch { Alert.alert("Error", "Chat clear nahi hui, dobara try karo"); }
                }
            },
        ]);
    };

    const handleTyping = (text) => {
        setInputText(text);
        socketService.emit("typing", { chatId });
        clearTimeout(typingTimer.current);
        typingTimer.current = setTimeout(() => socketService.emit("stop-typing", { chatId }), 1500);
    };

    const getFullUrl = (url) => `${Config?.MEDIA_URL}${url}`;
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

    const uploadMedia = async (localUri, mimeType, messageType) => {
        const ext = localUri.split(".").pop() ?? mimeType.split("/")[1] ?? "bin";
        const fd = new FormData();
        await appendFile(fd, "media", { uri: localUri, name: `${messageType}_${Date.now()}.${ext}`, type: mimeType });

        const res = await apiService({ method: "POST", endpoint: "users/media", data: fd, isMultipart: true });
        const json = res?.data;
        if (!res?.success || !json?.success) throw new Error(json?.message ?? res?.error?.message ?? "Media upload failed");
        return { url: json.data.url, filename: json.data.filename, fileType: json.data.fileType, fileSize: json.data.fileSize };
    };

    const sendMessage = async ({ content = "", messageType = "text", uploadedData = null }) => {
        if (messageType === "text" && !content.trim()) return;
        if (messageType !== "text" && !uploadedData) return;
        closeSearch();
        const tempId = `temp_${Date.now()}`;
        setMessages((prev) => [{
            _id: tempId, content, messageType, chat: chatId,
            sender: { _id: MY_USER_ID, name: maniAllData?.user?.name ?? "You" },
            status: "sending", isOptimistic: true, readBy: [], deliveredTo: [],
            createdAt: new Date().toISOString(),
            attachments: uploadedData ? [uploadedData] : [],
            ...(replyMsg ? { replyTo: replyMsg } : {}),
        }, ...prev]);
        setInputText(""); setReplyMsg(null); setShowEmoji(false); setSending(true);
        try {
            const payload = {
                chatId, content, messageType,
                ...(replyMsg ? { replyTo: replyMsg._id } : {}),
                ...(uploadedData ? { attachments: [{ url: uploadedData.url, filename: uploadedData.filename, fileType: uploadedData.fileType, fileSize: uploadedData.fileSize }] } : {}),
            };
            if (isBroadcast && broadcastIds.length) {
                await Promise.all(broadcastIds.map((id) => apiService({ method: "POST", endpoint: "messages", data: { ...payload, chatId: id } })));
                setMessages((prev) => prev.filter((m) => m._id !== tempId));
            } else {
                const res = await apiService({ method: "POST", endpoint: "messages", data: payload });
                if (res?.success) {
                    setMessages((prev) => prev.map((m) => m._id === tempId ? { ...res.data.message, status: "sent", isOptimistic: false } : m));
                    socketService.emit("new-message", res.data.message);
                } else throw new Error(res?.message ?? "Send failed");
            }
        } catch {
            setMessages((prev) => prev.map((m) => m._id === tempId ? { ...m, status: "failed" } : m));
        } finally {
            setSending(false);
            socketService.emit("stop-typing", { chatId });
        }
    };

    const retryMessage = (m) => { setMessages((prev) => prev.filter((p) => p._id !== m._id)); sendMessage({ content: m.content, messageType: m.messageType }); };

    const openCamera = async () => {
        setShowAttach(false);
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== "granted") return Alert.alert("Permission chahiye", "Camera allow karo");
        const res = await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.All, quality: 0.8 });
        if (!res.canceled) {
            const a = res.assets[0], isVid = a.type === "video";
            try { setUploading(true); const up = await uploadMedia(a.uri, isVid ? "video/mp4" : "image/jpeg", isVid ? "video" : "image"); sendMessage({ content: "", messageType: isVid ? "video" : "image", uploadedData: up }); }
            catch (e) { Alert.alert("Upload failed", e.message); }
            finally { setUploading(false); }
        }
    };

    const openGallery = async () => {
        setShowAttach(false);
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== "granted") return Alert.alert("Permission chahiye", "Gallery allow karo");
        const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.All, allowsMultipleSelection: true, quality: 0.8 });
        if (!res.canceled) {
            for (const a of res.assets) {
                const isVid = a.type === "video";
                try { setUploading(true); const up = await uploadMedia(a.uri, isVid ? "video/mp4" : "image/jpeg", isVid ? "video" : "image"); await sendMessage({ content: "", messageType: isVid ? "video" : "image", uploadedData: up }); }
                catch (e) { Alert.alert("Upload failed", e.message); }
                finally { setUploading(false); }
            }
        }
    };

    const openDocument = async () => {
        setShowAttach(false);
        const res = await DocumentPicker.getDocumentAsync({ type: "*/*", copyToCacheDirectory: true });
        if (res.type === "success" || res.assets?.length) {
            const file = res.assets?.[0] ?? res;
            try { setUploading(true); const up = await uploadMedia(file.uri, file.mimeType ?? "application/octet-stream", "document"); sendMessage({ content: file.name, messageType: "document", uploadedData: up }); }
            catch (e) { Alert.alert("Document upload failed", e.message); }
            finally { setUploading(false); }
        }
    };

    const openVideoGallery = async () => {
        setShowAttach(false);
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== "granted") return Alert.alert("Permission chahiye", "Gallery allow karo");
        const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Videos, allowsMultipleSelection: false, quality: 1 });
        if (!res.canceled) {
            try { setUploading(true); const up = await uploadMedia(res.assets[0].uri, "video/mp4", "video"); sendMessage({ content: "", messageType: "video", uploadedData: up }); }
            catch (e) { Alert.alert("Video upload failed", e.message); }
            finally { setUploading(false); }
        }
    };

    const startRecording = async () => {
        setShowAttach(false);
        const { status } = await requestRecordingPermissionsAsync();
        if (status !== "granted") return Alert.alert("Permission chahiye", "Mic allow karo");
        await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
        await audioRecorder.prepareToRecordAsync();
        audioRecorder.record();
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
        await audioRecorder.stop();
        const uri = audioRecorder.uri;
        setRecordSecs(0);
        await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
        if (!uri) return;
        try { setUploading(true); const up = await uploadMedia(uri, "audio/m4a", "audio"); sendMessage({ content: "", messageType: "audio", uploadedData: up }); }
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

    const openPopup = (item) => { if (item.isDeleted) return; setSelectedMsg(item); setShowPopup(true); };
    const closePopup = () => { setShowPopup(false); setSelectedMsg(null); };
    const handleReply = () => { setReplyMsg(selectedMsg); closePopup(); };
    const handleDelete = () => { const id = selectedMsg?._id; closePopup(); deleteMessage(id, false); };
    const handleDeleteAll = () => { const id = selectedMsg?._id; closePopup(); deleteMessage(id, true); };
    const handleStar = async () => { closePopup(); await apiService({ method: "PUT", endpoint: `messages/${selectedMsg?._id}/star` }); };
    const handleReact = (emoji) => { closePopup(); reactToMessage(selectedMsg?._id, emoji); };
    const handleForward = () => { setForwardMsgIds([selectedMsg?._id]); closePopup(); setShowForward(true); };
    const handleForwardSelected = () => { if (selectedMsgIds.size === 0) return; setForwardMsgIds([...selectedMsgIds]); setShowForward(true); };

    const doForward = async (chatIds) => {
        setShowForward(false);
        try {
            await apiService({ method: "POST", endpoint: "messages/forward", data: { messageIds: forwardMsgIds, chatIds } });
            navigation.navigate("Freechat");
            Alert.alert("✓ Forwarded", `${forwardMsgIds.length > 1 ? forwardMsgIds.length + " messages" : "Message"} sent to ${chatIds.length} chat${chatIds.length > 1 ? "s" : ""}`);
        } catch (e) { Alert.alert("Forward failed", e.message); }
        finally { cancelSelectMode(); }
    };

    const handleBlock = () => {
        const senderId = selectedMsg?.sender?._id ?? selectedMsg?.sender;
        closePopup();
        Alert.alert("Block User", "Are you sure you want to block this user?", [
            { text: "Cancel", style: "cancel" },
            {
                text: "Block", style: "destructive", onPress: async () => {
                    try { await apiService({ method: "POST", endpoint: `users/${senderId}/block` }); Alert.alert("Blocked", "User has been blocked."); }
                    catch { Alert.alert("Error", "Could not block user. Try again."); }
                }
            },
        ]);
    };

    const deleteMessage = async (msgId, forEveryone = false) => {
        if (!msgId) return;
        const ids = Array.isArray(msgId) ? msgId : [msgId];
        try {
            if (forEveryone) {
                // Delete for everyone — ek ek message DELETE karo
                await Promise.all(
                    ids.map((id) => apiService({ method: "DELETE", endpoint: `messages`, data: { messageIds: [ids] } }))
                );
                // Local state mein isDeleted mark karo
                setMessages((prev) => prev.map((m) =>
                    ids.includes(m._id)
                        ? { ...m, isDeleted: true, content: 'This message was deleted', attachments: [] }
                        : m
                ));
            } else {
                // Delete for me — sirf apni list se hata do
                await apiService({ method: "DELETE", data: { messageIds: ids }, endpoint: "messages/delete-for-me" });
                // Local state se completely remove karo (sirf mere liye)
                setMessages((prev) => prev.filter((m) => !ids.includes(m._id)));
            }
        } catch { Alert.alert("Error", "Message delete nahi hua, dobara try karo"); }
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

    const reactToMessage = async (msgId, emoji) => {
        setMessages((prev) => prev.map((m) => {
            if (m._id !== msgId) return m;
            const reactions = [...(m.reactions ?? [])];
            const idx = reactions.findIndex((r) => r.userId === MY_USER_ID);
            if (idx >= 0) reactions[idx] = { userId: MY_USER_ID, emoji }; else reactions.push({ userId: MY_USER_ID, emoji });
            return { ...m, reactions };
        }));
        await apiService({ method: "PUT", endpoint: `messages/${msgId}/react`, data: { emoji } });
    };

    const openDocInBrowser = async (url) => {
        const fullUrl = getFullUrl(url);
        try {
            if (await Linking.canOpenURL(fullUrl)) await Linking.openURL(fullUrl);
            else Alert.alert("Error", "File open nahi ho sakti");
        } catch (e) { Alert.alert("Error", e.message); }
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

            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === "ios" ? "padding" : "height"}
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

                {!isSelectMode && (
                    <TextInputSection
                        inputText={inputText}
                        handleTyping={handleTyping}
                        showEmoji={showEmoji}
                        setShowEmoji={setShowEmoji}
                        keyboardH={keyboardH}
                        sending={sending}
                        sendMessage={sendMessage}
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
                    onForward={handleForward}
                    onStar={handleStar}
                    onReact={handleReact}
                    onBlock={handleBlock}
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
    chatBg: { flex: 1, width: '100%', height: "110%" },
    searchInfo: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
    searchInfoText: { color: "#999", fontSize: 14, textAlign: "center" },
    uploadOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center' },
    uploadCard: { minWidth: 160, paddingHorizontal: 28, paddingVertical: 24, borderRadius: 14, alignItems: 'center', gap: 14, elevation: 6 },
    uploadCardText: { fontSize: 15, fontWeight: '500' },
});