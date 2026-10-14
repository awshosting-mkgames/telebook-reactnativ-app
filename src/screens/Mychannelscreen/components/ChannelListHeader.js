// components/ChannelListHeader.js
import React, { useContext } from 'react';
import {
    View, Text, StyleSheet, Image, TouchableOpacity, Platform, StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { ThemeContext } from '../../../components/ThemeContext';
import Config from '../../../services/config';

const getImg = (path) => {
    if (!path) return null;
    if (typeof path === 'string' && path.startsWith('http')) return path;
    return `${Config.MEDIA_URL}${path}`;
};

const fmtCount = (n) => {
    if (!n && n !== 0) return '0';
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return String(n);
};

export default function ChannelListHeader({
    channel, posts, activeTab, setActiveTab,
    onBack, onEdit, onNewPost, onDeleteChannel,
}) {
    const { t } = useTranslation();

    const { theme } = useContext(ThemeContext);
    const isLight = theme?.mode === 'light';
    const styles = getStyles(isLight);

    const channelName = channel?.channelName || channel?.name || 'My Channel';
    const iconUrl = getImg(channel?.channelIcon || channel?.avatar);
    const subCount = channel?.subscriberCount ?? channel?.subscribers?.length ?? 0;
    const postCount = channel?.totalMessages ?? posts.length;
    const desc = channel?.channelDescription || channel?.description || '';

    return (
        <View style={styles.headerBlock}>

            {/* Blue Banner */}
            <View style={styles.banner}>
                <TouchableOpacity style={styles.backBtn} onPress={onBack}>
                    <Ionicons name="arrow-back" size={20} color="#fff" />
                </TouchableOpacity>

                {/* ✅ Right side: Edit + Delete buttons */}
                <View style={styles.topRightRow}>
                    <TouchableOpacity style={styles.topBtn} onPress={onEdit}>
                        <Ionicons name="create-outline" size={20} color="#fff" />
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.topBtn, styles.deleteBtn]}
                        onPress={onDeleteChannel}
                    >
                        <Ionicons name="trash-outline" size={20} color="#fff" />
                    </TouchableOpacity>
                </View>

                <View style={styles.iconOuter}>
                    {iconUrl
                        ? <Image source={{ uri: iconUrl }} style={styles.channelIcon} />
                        : <View style={[styles.channelIcon, styles.iconFb]}>
                            <Ionicons name="megaphone" size={32} color="#1296f3" />
                        </View>
                    }
                    <TouchableOpacity style={styles.camBadge} onPress={onEdit}>
                        <Ionicons name="camera" size={12} color="#fff" />
                    </TouchableOpacity>
                </View>
            </View>

            {/* Info */}
            <View style={styles.infoArea}>
                <Text style={styles.channelName}>{channelName}</Text>
                {!!desc && <Text style={styles.desc} numberOfLines={2}>{desc}</Text>}



                {/* New Post Button */}
                <TouchableOpacity style={styles.newPostBtn} onPress={onNewPost}>
                    <Ionicons name="add-circle-outline" size={18} color="#fff" />
                    <Text style={styles.newPostTxt}>Add New Post</Text>
                </TouchableOpacity>
            </View>

            {/* Tabs */}
            <View style={styles.tabsRow}>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'posts' && styles.tabActive]}
                    onPress={() => setActiveTab('posts')}
                >
                    <Ionicons name="albums-outline" size={16} color={activeTab === 'posts' ? '#1296f3' : (isLight ? '#aaa' : '#6b6f76')} />
                    <Text style={[styles.tabTxt, activeTab === 'posts' && styles.tabTxtActive]}>
                        Posts ({posts.length})
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.tab, activeTab === 'subscribers' && styles.tabActive]}
                    onPress={() => setActiveTab('subscribers')}
                >
                    <Ionicons name="people-outline" size={16} color={activeTab === 'subscribers' ? '#1296f3' : (isLight ? '#aaa' : '#6b6f76')} />
                    <Text style={[styles.tabTxt, activeTab === 'subscribers' && styles.tabTxtActive]}>
                        Subscribers ({fmtCount(subCount)})
                    </Text>
                </TouchableOpacity>
            </View>

            {/* Tab Indicator */}
            <View style={styles.indicatorTrack}>
                <View style={[styles.indicator, activeTab === 'subscribers' && { marginLeft: '50%' }]} />
            </View>
        </View>
    );
}

const getStyles = (isLight) => StyleSheet.create({
    headerBlock: { backgroundColor: isLight ? '#fff' : '#1a1d23', marginBottom: 10 },

    banner: { height: 170, backgroundColor: '#1296f3', alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 44 },
    backBtn: { position: 'absolute', top: Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 8 : 52, left: 16, backgroundColor: 'rgba(0,0,0,0.25)', borderRadius: 20, padding: 8 },

    // ✅ edit + delete ek row mein, right side
    topRightRow: {
        position: 'absolute',
        top: Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 8 : 52,
        right: 16,
        flexDirection: 'row',
        gap: 10,
    },
    topBtn: {
        backgroundColor: 'rgba(0,0,0,0.25)',
        borderRadius: 20,
        padding: 8,
    },
    deleteBtn: {
        backgroundColor: 'rgba(231,76,60,0.85)', // red-ish, alag dikhe
    },

    iconOuter: { position: 'absolute', bottom: -36 },
    channelIcon: { width: 80, height: 80, borderRadius: 40, borderWidth: 4, borderColor: isLight ? '#fff' : '#1a1d23', backgroundColor: '#e8f4fd' },
    iconFb: { alignItems: 'center', justifyContent: 'center' },
    camBadge: { position: 'absolute', bottom: 2, right: 2, backgroundColor: '#1296f3', width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: isLight ? '#fff' : '#1a1d23' },

    infoArea: { alignItems: 'center', paddingTop: 48, paddingBottom: 16, paddingHorizontal: 20 },
    channelName: { fontSize: 20, fontWeight: '800', color: isLight ? '#111' : '#f5f5f5', textAlign: 'center', marginBottom: 6 },
    desc: { fontSize: 13, color: isLight ? '#888' : '#9aa0a6', textAlign: 'center', lineHeight: 19, marginBottom: 14 },

    statsRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: isLight ? '#f4f6fb' : '#22252b', borderRadius: 16, paddingVertical: 14, paddingHorizontal: 30, width: '100%', marginBottom: 14, gap: 20 },
    statBox: { flex: 1, alignItems: 'center', gap: 4 },
    statNum: { fontSize: 20, fontWeight: '900', color: isLight ? '#111' : '#f5f5f5' },
    statLbl: { fontSize: 12, color: isLight ? '#aaa' : '#8a8f96', fontWeight: '500' },
    statSep: { width: 1, height: 36, backgroundColor: isLight ? '#e0e0e0' : '#2a2d33' },

    newPostBtn: { width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#1296f3', paddingVertical: 13, borderRadius: 14, elevation: 3, shadowColor: '#1296f3', shadowOpacity: 0.3, shadowRadius: 6, marginTop: 20 },
    newPostTxt: { color: '#fff', fontWeight: '800', fontSize: 15 },

    tabsRow: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: isLight ? '#f0f0f0' : '#2a2d33', marginTop: 10 },
    tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 14 },
    tabTxt: { fontSize: 14, fontWeight: '600', color: isLight ? '#bbb' : '#6b6f76' },
    tabTxtActive: { color: '#1296f3' },
    indicatorTrack: { height: 2.5, backgroundColor: isLight ? '#f0f0f0' : '#2a2d33' },
    indicator: { width: '50%', height: '100%', backgroundColor: '#1296f3', borderRadius: 2 },
});