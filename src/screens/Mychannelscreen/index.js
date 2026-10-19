// screens/Mychannelscreen/index.js
import { Ionicons } from '@expo/vector-icons';
import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator, Alert,
    FlatList,
    RefreshControl,
    SafeAreaView, StatusBar,
    StyleSheet,
    TouchableOpacity,
    View,
} from 'react-native';
import apiService from '../../services/apiService';
import {
    POSTS_PAGE_SIZE, copyChannelLink, fetchChannelById, fetchPostsPage,
    mergePosts, shareChannelLink, showToast,
} from '../../services/channelActions';
import { ThemeContext } from '../../components/ThemeContext';

// ── Components ────────────────────────────────────────────────────────────────
import ChannelListHeader from './components/ChannelListHeader';
import DeleteChannelModal from './components/DeleteChannelModal';
import EditChannelPopup from './components/EditChannelPopup';
import NewPostModal from './components/NewPostModal';
import PostActions from './components/PostActions';
import PostCard from './components/PostCard';
import SubCard from './components/SubCard';

export default function MyChannelScreen({ navigation, route }) {
    const { channelId } = route?.params ?? {};

    const { theme } = useContext(ThemeContext);
    const isLight = theme?.mode === 'light';
    const styles = getStyles(isLight);
    const headerBg = theme?.header || '#1199ff';
    const listRef = useRef(null);

    const [channel, setChannel] = useState(null);
    const [posts, setPosts] = useState([]);
    const [subscribers, setSubscribers] = useState([]);
    const [activeTab, setActiveTab] = useState('posts');
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [subLoading, setSubLoading] = useState(false);
    const [showNewPost, setShowNewPost] = useState(false);
    const [showEdit, setShowEdit] = useState(false);
    const [showDelete, setShowDelete] = useState(false);   // ✅ delete popup
    const [selectedPost, setSelectedPost] = useState(null); // long-press action sheet
    // Pagination: posts newest-first rakhe jate hain, list `inverted` hai => newest neeche
    const [hasMore, setHasMore] = useState(false);
    const pageRef = useRef(1);
    const loadingMoreRef = useRef(false);

    // ── API ───────────────────────────────────────────────────────────────────
    const fetchChannel = useCallback(async () => {
        try {
            const res = await apiService({ method: 'GET', endpoint: `channels/${channelId}` });
            setChannel(res?.data?.channel ?? res?.channel ?? res?.data ?? res);
        } catch (e) { console.error(e); }
    }, [channelId]);

    // Page 1 = sabse naye posts. Reset/refresh par list replace hoti hai.
    const fetchPosts = useCallback(async () => {
        try {
            const r = await fetchPostsPage(channelId, 1, POSTS_PAGE_SIZE);
            if (!r) return;
            pageRef.current = 1;
            setPosts(mergePosts([], r.posts));
            setHasMore(r.hasMore);
        } catch (e) { console.error(e); }
    }, [channelId]);

    // Purane posts: user upar scroll kare to agla page; _id se de-dupe
    const loadMorePosts = useCallback(async () => {
        if (loadingMoreRef.current || !hasMore) return;
        loadingMoreRef.current = true;
        try {
            const next = pageRef.current + 1;
            const r = await fetchPostsPage(channelId, next, POSTS_PAGE_SIZE);
            if (r) {
                pageRef.current = next;
                setPosts(prev => mergePosts(prev, r.posts));
                setHasMore(r.hasMore);
            }
        } catch (e) { console.error(e); }
        finally { loadingMoreRef.current = false; }
    }, [channelId, hasMore]);

    const fetchSubscribers = useCallback(async () => {
        try {
            setSubLoading(true);
            const res = await apiService({ method: 'GET', endpoint: `channels/${channelId}/subscribers` });
            setSubscribers(res?.subscribers ?? res?.data?.subscribers ?? []);
        } catch (e) { console.error(e); }
        finally { setSubLoading(false); }
    }, [channelId]);

    const loadAll = useCallback(async (isRefresh = false) => {
        if (!isRefresh) setLoading(true); else setRefreshing(true);
        await Promise.all([fetchChannel(), fetchPosts()]);
        setLoading(false); setRefreshing(false);
    }, [fetchChannel, fetchPosts]);

    useEffect(() => { loadAll(); }, []);

    useEffect(() => {
        if (activeTab === 'subscribers' && subscribers.length === 0) {
            fetchSubscribers();
        }
    }, [activeTab]);

    // ── Handlers ──────────────────────────────────────────────────────────────
    const handleDelete = (postId) => {
        Alert.alert('Delete Karo?', 'Post permanently delete ho jayega', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete', style: 'destructive',
                onPress: async () => {
                    setPosts(p => p.filter(x => x._id !== postId)); // optimistic
                    try {
                        await apiService({ method: 'DELETE', endpoint: `channels/${channelId}/messages/${postId}` });
                    } catch {
                        Alert.alert('Error', 'Delete nahi hua');
                        fetchPosts(); // rollback
                    }
                },
            },
        ]);
    };

    const handlePosted = (newPost) => {
        // Naya post sabse upar (newest-first data) => inverted list me sabse neeche
        if (newPost?._id) {
            setPosts(p => mergePosts([newPost], p));
            requestAnimationFrame(() => listRef.current?.scrollToOffset?.({ offset: 0, animated: true }));
        } else {
            fetchPosts().then(() => listRef.current?.scrollToOffset?.({ offset: 0, animated: true }));
        }
        fetchChannel();
    };

    const handleUpdated = (updated) => {
        // merge: update response me shareUrl na ho to purani value na jaye
        if (updated) setChannel(prev => ({ ...(prev || {}), ...updated })); else fetchChannel();
    };

    // ✅ Channel delete success → back chale jao
    const handleChannelDeleted = () => {
        navigation.goBack();
    };

    // ── Copy / Share link (sirf shareUrl; internal id kabhi nahi) ─────────────
    const ensureChannelWithShareUrl = async () => {
        if (channel?.shareUrl) return channel;
        const c = await fetchChannelById(channelId);
        if (c) setChannel(prev => ({ ...(prev || {}), ...c }));
        return c;
    };
    const handleCopyLink = async () => {
        const c = await ensureChannelWithShareUrl();
        if (!copyChannelLink(c?.shareUrl)) showToast('Link not available', 'error');
    };
    const handleShareLink = async () => {
        const c = await ensureChannelWithShareUrl();
        if (!(await shareChannelLink(c))) {
            if (!c?.shareUrl) showToast('Link not available', 'error');
        }
    };

    // ── Shared ListHeader ─────────────────────────────────────────────────────
    const ListHeader = () => (
        <ChannelListHeader
            channel={channel}
            posts={posts}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            onBack={() => navigation.goBack()}
            onEdit={() => setShowEdit(true)}
            onNewPost={() => setShowNewPost(true)}
            onDeleteChannel={() => setShowDelete(true)}
            onCopyLink={handleCopyLink}
            onShareLink={handleShareLink}
        />
    );

    if (loading) {
        return (
            <SafeAreaView style={styles.container}>
                <StatusBar backgroundColor={headerBg} barStyle="light-content" />
                <ActivityIndicator color={headerBg} size="large" style={{ marginTop: 120 }} />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar backgroundColor="transparent" translucent barStyle="light-content" />

            {/* POSTS TAB */}
            {activeTab === 'posts' ? (
                <FlatList
                    ref={listRef}
                    inverted
                    data={posts}
                    keyExtractor={(item, i) => (item?._id || i).toString()}
                    renderItem={({ item }) => <PostCard item={item} onDelete={handleDelete} onLongPress={setSelectedPost} />}
                    // inverted list me Footer = visual top: channel header sabse upar, posts uske neeche,
                    // sabse naya post sabse neeche
                    ListFooterComponent={<ListHeader />}
                    onEndReached={loadMorePosts}
                    onEndReachedThreshold={0.4}
                    // FAB (bottom) ke neeche content na chhupe => inverted me paddingTop = visual bottom
                    contentContainerStyle={{ paddingTop: 110, flexGrow: 1, justifyContent: 'flex-end' }}
                    showsVerticalScrollIndicator={false}
                    ListEmptyComponent={
                        <View style={styles.empty}>
                            <Ionicons name="cloud-upload-outline" size={50} color={isLight ? '#ddd' : '#3a3d44'} />
                            <TouchableOpacity style={styles.emptyBtn} onPress={() => setShowNewPost(true)}>
                                <Ionicons name="add" size={16} color="#fff" />
                            </TouchableOpacity>
                        </View>
                    }
                />
            ) : (
                /* SUBSCRIBERS TAB */
                <FlatList
                    data={subscribers}
                    keyExtractor={(item, i) => (item?._id || i).toString()}
                    renderItem={({ item }) => <SubCard item={item} />}
                    ListHeaderComponent={<ListHeader />}
                    contentContainerStyle={{ paddingBottom: 110 }}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl refreshing={subLoading} onRefresh={fetchSubscribers} colors={['#1296f3']} />
                    }
                    ListEmptyComponent={
                        subLoading
                            ? <ActivityIndicator color="#1296f3" style={{ marginTop: 40 }} />
                            : (
                                <View style={styles.empty}>
                                    <Ionicons name="people-outline" size={50} color={isLight ? '#ddd' : '#3a3d44'} />
                                </View>
                            )
                    }
                />
            )}

            <PostActions
                post={selectedPost}
                channelId={channelId}
                onClose={() => setSelectedPost(null)}
                colors={{
                    bg: isLight ? '#fff' : '#1a1d23',
                    text: isLight ? '#111' : '#f5f5f5',
                    border: isLight ? '#ddd' : '#3a3d44',
                    accent: headerBg,
                }}
            />

            {/* FAB */}
            <TouchableOpacity style={styles.fab} onPress={() => setShowNewPost(true)}>
                <Ionicons name="add" size={28} color="#fff" />
            </TouchableOpacity>

            {/* Modals */}
            <NewPostModal
                visible={showNewPost}
                onClose={() => setShowNewPost(false)}
                channelId={channelId}
                onPosted={handlePosted}
            />
            <EditChannelPopup
                visible={showEdit}
                onClose={() => setShowEdit(false)}
                channel={channel}
                onUpdated={handleUpdated}
            />
            {/* ✅ Delete Channel confirmation popup */}
            <DeleteChannelModal
                visible={showDelete}
                onClose={() => setShowDelete(false)}
                channel={channel}
                onDeleted={handleChannelDeleted}
            />
        </SafeAreaView>
    );
}

const getStyles = (isLight) => StyleSheet.create({
    container: { flex: 1, backgroundColor: isLight ? '#f4f6fb' : '#0f1115' },
    empty: { alignItems: 'center', paddingTop: 50, gap: 10 },
    emptyBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#1296f3', paddingHorizontal: 22, paddingVertical: 11, borderRadius: 14, marginTop: 6 },
    fab: { position: 'absolute', bottom: 28, right: 20, width: 60, height: 60, borderRadius: 30, backgroundColor: '#1296f3', alignItems: 'center', justifyContent: 'center', elevation: 8, shadowColor: '#1296f3', shadowOpacity: 0.4, shadowRadius: 10 },
});