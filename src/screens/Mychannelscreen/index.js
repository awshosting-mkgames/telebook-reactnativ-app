// screens/Mychannelscreen/index.js
import { Ionicons } from '@expo/vector-icons';
import { useCallback, useContext, useEffect, useState } from 'react';
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
import { ThemeContext } from '../../components/ThemeContext';

// ── Components ────────────────────────────────────────────────────────────────
import ChannelListHeader from './components/ChannelListHeader';
import DeleteChannelModal from './components/DeleteChannelModal';
import EditChannelPopup from './components/EditChannelPopup';
import NewPostModal from './components/NewPostModal';
import PostCard from './components/PostCard';
import SubCard from './components/SubCard';

export default function MyChannelScreen({ navigation, route }) {
    const { channelId } = route?.params ?? {};

    const { theme } = useContext(ThemeContext);
    const isLight = theme?.mode === 'light';
    const styles = getStyles(isLight);

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

    // ── API ───────────────────────────────────────────────────────────────────
    const fetchChannel = useCallback(async () => {
        try {
            const res = await apiService({ method: 'GET', endpoint: `channels/${channelId}` });
            setChannel(res?.data?.channel ?? res?.channel ?? res?.data ?? res);
        } catch (e) { console.error(e); }
    }, [channelId]);

    const fetchPosts = useCallback(async () => {
        try {
            const res = await apiService({ method: 'GET', endpoint: `channels/${channelId}/messages` });
            const list = res?.messages ?? res?.data?.messages ?? [];
            setPosts(Array.isArray(list) ? [...list].reverse() : []);
        } catch (e) { console.error(e); }
    }, [channelId]);

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
        if (newPost) setPosts(p => [...p, newPost]); else fetchPosts();
        fetchChannel();
    };

    const handleUpdated = (updated) => {
        if (updated) setChannel(updated); else fetchChannel();
    };

    // ✅ Channel delete success → back chale jao
    const handleChannelDeleted = () => {
        navigation.goBack();
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
        />
    );

    if (loading) {
        return (
            <SafeAreaView style={styles.container}>
                <StatusBar backgroundColor="#1296f3" barStyle="light-content" />
                <ActivityIndicator color="#1296f3" size="large" style={{ marginTop: 120 }} />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar backgroundColor="transparent" translucent barStyle="light-content" />

            {/* POSTS TAB */}
            {activeTab === 'posts' ? (
                <FlatList
                    data={posts}
                    keyExtractor={(item, i) => (item?._id || i).toString()}
                    renderItem={({ item }) => <PostCard item={item} onDelete={handleDelete} />}
                    ListHeaderComponent={<ListHeader />}
                    contentContainerStyle={{ paddingBottom: 110 }}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={() => loadAll(true)} colors={['#1296f3']} />
                    }
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