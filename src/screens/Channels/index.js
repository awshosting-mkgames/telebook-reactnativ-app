import React, { useState, useContext, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    Image,
    SafeAreaView,
    StatusBar,
    Platform,
    ActivityIndicator,
    Alert,
    Dimensions,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { ThemeContext } from '../../components/ThemeContext';
import apiService from '../../services/apiService';
import Config from '../../services/config';
const BASE_URL = Config.Main_url;

const { width, height } = Dimensions.get('window');

const Channels = ({ navigation }) => {
    const { t } = useTranslation();
    const { theme } = useContext(ThemeContext);
    const [channels, setChannels] = useState([]);
    const [loading, setLoading] = useState(true);
    const [following, setFollowing] = useState({});
    const [loadingFollow, setLoadingFollow] = useState({});

    const fetchChannels = useCallback(async () => {
        try {
            setLoading(true);
            const response = await apiService({
                method: 'GET',
                endpoint: 'channels',
            });

            const list = response?.data?.channels ?? [];
            setChannels(list);


            const followMap = {};
            list.forEach(item => {
                followMap[item._id] =
                    item.isSubscribed ?? item.is_followed ?? false;
            });
            setFollowing(followMap);
        } catch (e) {
            console.error('Channels fetch error:', e);
            Alert.alert('Error', 'Channels load nahi hue');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchChannels();
    }, [fetchChannels]);

    const handleFollow = async (item) => {
        const isFollowed = following[item._id];
        setFollowing(prev => ({ ...prev, [item._id]: !isFollowed }));
        setLoadingFollow(prev => ({ ...prev, [item._id]: true }));
        try {
            await apiService({
                method: 'PUT',
                endpoint: isFollowed
                    ? `channels/${item._id}/unsubscribe`
                    : `channels/${item._id}/subscribe`,
                data: {},
            });
        } catch (e) {
            console.error('Follow error:', e);
            setFollowing(prev => ({ ...prev, [item._id]: isFollowed }));
            Alert.alert('Error', 'Kuch gadbad ho gayi, dobara try karo');
        } finally {
            setLoadingFollow(prev => ({ ...prev, [item._id]: false }));
        }
    };

    const gotoChannalDetils = (item) => {
        navigation.navigate('Channeldetailscreen', { channelId: item?._id });
    };

    const renderItem = ({ item }) => {

        const isFollowed = following[item._id];
        const isLoading = loadingFollow[item._id];

        const name = item.channelName ?? 'Unknown';
        const imageUri = item.channelIcon
            ? `${BASE_URL?.MEDIA_URL}${item.channelIcon}`
            : '';
        const followerCount = item.subscribers?.length ?? 0;
        const isVerified = item.verified ?? false;

        return (
            <View style={styles.row}>
                <TouchableOpacity onPress={() => gotoChannalDetils(item)} style={styles.left}>
                    {imageUri ? (
                        <Image source={{ uri: imageUri }} style={styles.avatar} />
                    ) : (
                        <View style={[styles.avatar, styles.avatarPlaceholder]}>
                            <Ionicons name="person" size={20} color="#aaa" />
                        </View>
                    )}
                    <View>
                        <View style={styles.nameRow}>
                            <Text style={[styles.name, { color: theme.text }]}>{name}</Text>
                            {isVerified && (
                                <Ionicons name="checkmark-circle" size={18} color="#1d9bf0" />
                            )}
                        </View>
                        <Text style={styles.followers}>
                            {followerCount} {followerCount === 1 ? 'Subscriber' : 'Subscribers'}
                        </Text>
                    </View>
                </TouchableOpacity>


                <TouchableOpacity
                    style={[styles.followBtn, isFollowed && styles.followedBtn]}
                    onPress={() => handleFollow(item)}
                    disabled={isLoading}
                    activeOpacity={0.8}
                >
                    {isLoading ? (
                        <ActivityIndicator
                            size="small"
                            color={isFollowed ? '#16a34a' : '#fff'}
                        />
                    ) : isFollowed ? (
                        <View style={styles.followedInner}>
                            <Ionicons name="checkmark-circle" size={16} color="#16a34a" />
                            <Text style={styles.followedText}>{t('Followed')}</Text>
                        </View>
                    ) : (
                        <Text style={styles.followText}>{t('Follow')}</Text>
                    )}
                </TouchableOpacity>
            </View>
        );
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <Ionicons name="arrow-back" size={20} color="#fff" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>{t('Channels')}</Text>
                {/* <View style={styles.headerRight}>
                    <Ionicons name="search" size={22} color="#fff" />
                    <Ionicons name="options-outline" size={22} color="#fff" style={{ marginLeft: 16 }} />
                </View> */}
            </View>

            {loading ? (
                <ActivityIndicator color="#1296f3" size="large" style={{ marginTop: 40 }} />
            ) : (
                <FlatList
                    data={channels}
                    keyExtractor={(item) => item._id}
                    renderItem={renderItem}
                    showsVerticalScrollIndicator={false}
                    onRefresh={fetchChannels}
                    refreshing={loading}
                    ListEmptyComponent={
                        <Text style={styles.empty}>Koi channel nahi mila</Text>
                    }
                />
            )}
        </SafeAreaView>
    );
};

export default Channels;

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    header: {
        height: 90,
        backgroundColor: '#1296f3',
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
    },
    headerTitle: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '500',
        marginLeft: 16,
        flex: 1,
    },
    headerRight: {
        flexDirection: 'row',
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,

        justifyContent: 'space-between',
    },
    left: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    avatar: {
        width: 48,
        height: 48,
        borderRadius: 24,
        marginRight: 12,
    },
    avatarPlaceholder: {
        backgroundColor: '#f0f0f0',
        alignItems: 'center',
        justifyContent: 'center',
    },
    nameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    name: {
        fontSize: 16,
        fontWeight: '600',
        color: '#000',
    },
    followers: {
        fontSize: 12,
        color: '#666',
        marginTop: 2,
    },

    // ── Follow (not subscribed) ──
    followBtn: {
        backgroundColor: '#1296f3',
        paddingHorizontal: 18,
        paddingVertical: 7,
        borderRadius: 20,
        minWidth: 104,
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 2,
        shadowColor: '#1296f3',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
    },
    followText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '700',
    },

    // ── Followed (isSubscribed === true) — soft green pill with tick ──
    followedBtn: {
        backgroundColor: '#e8f8ee',
        borderWidth: 1.5,
        borderColor: '#16a34a',
        elevation: 0,
        shadowOpacity: 0,
    },
    followedInner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
    },
    followedText: {
        color: '#16a34a',
        fontSize: 14,
        fontWeight: '700',
    },

    empty: {
        textAlign: 'center',
        color: '#999',
        marginTop: 60,
        fontSize: 15,
    },
});
