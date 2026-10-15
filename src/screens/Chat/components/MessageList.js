import { useCallback, useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    FlatList,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import MessageBubble from "./MessageBubble";


const isSameDay = (a, b) => {
    if (!a || !b) return false;
    const d1 = new Date(a);
    const d2 = new Date(b);
    return (
        d1.getDate() === d2.getDate() &&
        d1.getMonth() === d2.getMonth() &&
        d1.getFullYear() === d2.getFullYear()
    );
};

const MONTHS = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const formatDateLabel = (dateStr) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "";

    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    if (isSameDay(d, today)) return "Today";
    if (isSameDay(d, yesterday)) return "Yesterday";
    return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
};

// Center wala date chip
const DateSeparator = ({ label, isDark }) => {
    if (!label) return null;
    return (
        <View style={styles.dateSepWrap}>
            <View
                style={[
                    styles.dateSepPill,
                    { backgroundColor: isDark ? "#222e35" : "#e1f2fb" },
                ]}
            >
                <Text
                    style={[
                        styles.dateSepText,
                        { color: isDark ? "#cfd9df" : "#54656f" },
                    ]}
                >
                    {label}
                </Text>
            </View>
        </View>
    );
};

const MessageList = ({
    flatRef,
    messages = [],
    loading,
    MY_USER_ID,
    isGroup,
    isBroadcast,
    theme,
    getFullUrl,
    setImageModalUri,
    setVideoModalUri,
    openPopup,
    openDocInBrowser,
    retryMessage,
    onCancelUpload,
    setReplyMsg,
    setShowEmoji,
    fmtTime,
    isSelectMode,
    selectedMsgIds,
    onSelectMsg,
    hasMore,
    loadingMore,
    onLoadMore,
    activeSearchId,      // abhi active match ka _id
    searchScrollNonce,   // har jump par badhta hai
    matchIdSet,          // saare matched ids ka Set (inline tint ke liye)
}) => {
    const [highlightedMsgId, setHighlightedMsgId] = useState(null);
    const [showScrollDown, setShowScrollDown] = useState(false);
    const [newMsgCount, setNewMsgCount] = useState(0);

    const isAtBottomRef = useRef(true);          // ✅ ref — stale state problem khatam
    const isLoadingMoreRef = useRef(false);
    const prevFirstIdRef = useRef(messages[0]?._id);  // ✅ newest msg id se detect karo, length se nahi
    const didInitialScroll = useRef(false);
    const pendingScrollIdRef = useRef(null);     // ✅ reply-scroll ke liye (agar msg abhi load nahi hua)


    const handleScroll = (event) => {
        const offsetY = event.nativeEvent.contentOffset.y;
        const atBottom = offsetY <= 30;
        isAtBottomRef.current = atBottom;
        setShowScrollDown(!atBottom);
        if (atBottom) setNewMsgCount(0);
    };

    const scrollToBottom = (animated = true) => {
        flatRef.current?.scrollToOffset({ offset: 0, animated });
        isAtBottomRef.current = true;
        setNewMsgCount(0);
    };

    // ─────────────────────────────────────────────
    // 📌 FIX 2: Naya message aaya → sirf tab scroll karo jab:
    //    (a) message MERA ho, ya (b) user pehle se bottom pe ho.
    //    Pagination se length badhne par ye trigger NAHI hoga,
    //    kyunki hum messages[0] (newest) ka _id compare kar rahe hain.
    useEffect(() => {
        const firstId = messages[0]?._id;
        if (!firstId || firstId === prevFirstIdRef.current) return;
        prevFirstIdRef.current = firstId;

        const newest = messages[0];
        const isMine =
            newest?.sender?._id === MY_USER_ID || newest?.sender === MY_USER_ID;

        if (isMine || isAtBottomRef.current) {
            // requestAnimationFrame → web pe bhi reliably chalega
            requestAnimationFrame(() => scrollToBottom(true));
        } else {
            // user upar padh raha hai → scroll mat karo, badge dikhao
            setNewMsgCount((c) => c + 1);
        }
    }, [messages, MY_USER_ID]);

    // ─────────────────────────────────────────────
    // 📌 Initial load → ek baar bottom pe
    useEffect(() => {
        if (!didInitialScroll.current && messages.length > 0) {
            didInitialScroll.current = true;
            requestAnimationFrame(() => {
                flatRef.current?.scrollToOffset({ offset: 0, animated: false });
            });
        }
    }, [messages.length, flatRef]);

    // ─────────────────────────────────────────────
    // 📌 FIX 1(b): Agar replied message pagination me load hua to
    //    pending scroll complete karo
    useEffect(() => {
        if (!pendingScrollIdRef.current) return;
        const index = messages.findIndex(
            (m) => m._id === pendingScrollIdRef.current
        );
        if (index !== -1) {
            const id = pendingScrollIdRef.current;
            pendingScrollIdRef.current = null;
            doScrollToIndex(index, id);
        } else if (hasMore && !loadingMore) {
            onLoadMore?.(); // aur purane messages load karo
        } else if (!hasMore) {
            pendingScrollIdRef.current = null; // mil hi nahi sakta
        }
    }, [messages, hasMore, loadingMore]);

    // ─────────────────────────────────────────────
    // 🔎 Search: active match par scroll + highlight (existing reply-scroll logic reuse)
    const prevSearchNonce = useRef(0);
    useEffect(() => {
        if (searchScrollNonce === prevSearchNonce.current) return;
        prevSearchNonce.current = searchScrollNonce;
        if (activeSearchId) scrollToOriginalMessage(activeSearchId);
    }, [searchScrollNonce, activeSearchId]);

    const doScrollToIndex = (index, msgId) => {
        setHighlightedMsgId(msgId);
        // chhota delay — taaki naye items render ho jayein
        setTimeout(() => {
            flatRef.current?.scrollToIndex({
                index,
                animated: true,
                viewPosition: 0.5,
            });
        }, 100);
        setTimeout(() => setHighlightedMsgId(null), 2500);
    };


    const scrollToOriginalMessage = (replyMsg) => {

        const replyMsgId =
            typeof replyMsg === "object" ? replyMsg?._id : replyMsg;
        if (!replyMsgId) return;

        const index = messages.findIndex((m) => m._id === replyMsgId);
        if (index !== -1) {
            doScrollToIndex(index, replyMsgId);
        } else if (hasMore) {
            // message abhi load nahi hua → pending rakho aur load more chalao
            pendingScrollIdRef.current = replyMsgId;
            onLoadMore?.();
        }
    };

    const onScrollToIndexFailed = useCallback((info) => {
        flatRef.current?.scrollToOffset({
            offset: info.averageItemLength * info.index,
            animated: false,
        });
        setTimeout(() => {
            flatRef.current?.scrollToIndex({
                index: info.index,
                animated: true,
                viewPosition: 0.5,
            });
        }, 300);
    }, [flatRef]);

    // ─────────────────────────────────────────────
    // 📌 Load more (pagination)
    const handleEndReached = useCallback(() => {
        if (!hasMore || loadingMore || isLoadingMoreRef.current) return;
        isLoadingMoreRef.current = true;
        onLoadMore?.();
        setTimeout(() => {
            isLoadingMoreRef.current = false;
        }, 3000);
    }, [hasMore, loadingMore, onLoadMore]);

    // ─────────────────────────────────────────────
    const renderItem = useCallback(
        ({ item, index }) => {
            // inverted list → messages[index + 1] PURANA (older) message hota hai.
            // Agar older message ki date alag hai (ya ye sabse purana msg hai),
            // matlab ye message naye din ka PEHLA message hai → uske upar date chip.
            const olderMsg = messages[index + 1];
            const showDateSep =
                !olderMsg || !isSameDay(item.createdAt, olderMsg.createdAt);
            const isDark = theme?.background === "#000";

            return (
                <View>
                    {showDateSep && (
                        <DateSeparator
                            label={formatDateLabel(item.createdAt)}
                            isDark={isDark}
                        />
                    )}
                    <MessageBubble
                        item={item}
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
                        onCancelUpload={onCancelUpload}
                        setReplyMsg={setReplyMsg}
                        setShowEmoji={setShowEmoji}
                        fmtTime={fmtTime}
                        isSelectMode={isSelectMode}
                        isSelected={selectedMsgIds?.has(item._id)}
                        onSelect={onSelectMsg}
                        onReplyPress={scrollToOriginalMessage}
                        isHighlighted={highlightedMsgId === item._id}
                        isMatch={matchIdSet?.has(item._id)}
                    />
                </View>
            );
        },
        [highlightedMsgId, isSelectMode, selectedMsgIds, theme, messages, matchIdSet, openPopup, retryMessage, onCancelUpload, MY_USER_ID, isGroup],
    );

    const ListFooterComponent = () => {
        if (loadingMore) {
            return (
                <View style={styles.loadMoreWrap}>
                    <ActivityIndicator size="small" color="#1296f3" />
                </View>
            );
        }
        if (!hasMore) {
            return (
                <View style={styles.allLoadedWrap}>
                    <Text style={styles.allLoadedText}>Start of conversation 🎉</Text>
                </View>
            );
        }
        return null;
    };

    // Full-screen blocking spinner sirf tab jab dikhane ke liye kuch bhi nahi
    // hai (asli pehli load). Agar cache/pehle se fetched messages maujood
    // hain, background refresh ke liye upar ek chhota inline indicator kaafi
    // hai — poori chat screen ko baar-baar block karna WhatsApp jaisa nahi tha.
    if (loading && messages.length === 0) {
        return (
            <View style={styles.loaderContainer}>
                <ActivityIndicator size="large" color="#1296f3" />
            </View>
        );
    }

    return (
        <View style={{ flex: 1 }}>
            {loading && messages.length > 0 && (
                <View style={styles.syncBar}>
                    <ActivityIndicator size="small" color="#1296f3" />
                </View>
            )}
            <FlatList
                ref={flatRef}
                data={messages}
                keyExtractor={(item, i) => item._id ?? i.toString()}
                renderItem={renderItem}
                inverted
                onScroll={handleScroll}
                scrollEventThrottle={16}
                onScrollToIndexFailed={onScrollToIndexFailed}
                onEndReached={handleEndReached}
                onEndReachedThreshold={0.2}
                ListFooterComponent={ListFooterComponent}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={styles.listContent}
                ListEmptyComponent={
                    <View style={styles.emptyWrap}>
                        <Text style={styles.empty}>
                            No message found 👋
                        </Text>
                    </View>
                }
            />

            {/* ⬇️ Scroll-to-bottom button + naye message ka badge */}
            {showScrollDown && (
                <TouchableOpacity
                    style={styles.scrollDownBtn}
                    onPress={() => scrollToBottom(true)}
                    activeOpacity={0.8}
                >
                    {newMsgCount > 0 && (
                        <View style={styles.badge}>
                            <Text style={styles.badgeText}>
                                {newMsgCount > 99 ? "99+" : newMsgCount}
                            </Text>
                        </View>
                    )}
                    <Ionicons name="chevron-down" size={22} color="#1296f3" />
                </TouchableOpacity>
            )}
        </View>
    );
};

export default MessageList;

const styles = StyleSheet.create({
    loaderContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
    syncBar: { position: "absolute", top: 6, left: 0, right: 0, alignItems: "center", zIndex: 5 },
    listContent: { padding: 10 },
    emptyWrap: { alignItems: "center", marginTop: 60 },
    empty: { color: "#999" },
    loadMoreWrap: { alignItems: "center", padding: 10 },
    allLoadedWrap: { alignItems: "center", margin: 10 },
    allLoadedText: { color: "#aaa", fontSize: 12 },

    // ── Date separator (WhatsApp jaisa center chip) ──
    dateSepWrap: {
        alignItems: "center",
        marginVertical: 10,
    },
    dateSepPill: {
        paddingHorizontal: 12,
        paddingVertical: 5,
        borderRadius: 8,
        elevation: 1,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.08,
        shadowRadius: 1,
    },
    dateSepText: {
        fontSize: 12,
        fontWeight: "600",
    },

    scrollDownBtn: {
        position: "absolute",
        right: 14,
        bottom: 16,
        width: 42,
        height: 42,
        borderRadius: 21,
        backgroundColor: "#fff",
        alignItems: "center",
        justifyContent: "center",
        elevation: 4,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
    },
    badge: {
        position: "absolute",
        top: -6,
        right: -2,
        minWidth: 18,
        height: 18,
        borderRadius: 9,
        backgroundColor: "#1296f3",
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 4,
        zIndex: 2,
    },
    badgeText: { color: "#fff", fontSize: 10, fontWeight: "700" },
});