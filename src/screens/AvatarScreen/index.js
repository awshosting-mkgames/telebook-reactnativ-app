import React, { useState, useContext } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, Image,
    SafeAreaView, StatusBar, ScrollView, Alert,
    ActivityIndicator, Platform
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as VideoThumbnails from 'expo-video-thumbnails';
import apiService from '../../services/apiService';
import { ThemeContext } from '../../components/ThemeContext';
import { useSelector, useDispatch } from 'react-redux';

import { settotalappData } from '../../redex/slices/totalappDataSlice';
import Config from '../../services/config';
import { appendFile } from '../../utils/uploadFile';
const BASE_URL = Config.Main_url;

const DEFAULT_AVATAR = 'https://cdn-icons-png.flaticon.com/512/149/149071.png';

// ── Helpers ───────────────────────────────────────────────────────────────────
const pickMedia = async (mediaTypes, allowsMultiple = false) => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please allow media access in settings.');
        return null;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes,
        allowsMultipleSelection: allowsMultiple,
        quality: 0.85,
        videoMaxDuration: 30,
    });
    if (result.canceled) return null;
    return result.assets;
};

const pickFromCamera = async (mediaTypes) => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please allow camera access in settings.');
        return null;
    }
    const result = await ImagePicker.launchCameraAsync({
        mediaTypes,
        quality: 0.85,
        videoMaxDuration: 30,
    });
    if (result.canceled) return null;
    return result.assets;
};

// ── StatusItem ────────────────────────────────────────────────────────────────
const StatusItem = ({ item, onRemove }) => {
    const isVideo = item.type === 'video';
    return (
        <View style={styles.statusThumb}>
            <Image
                source={{ uri: item.thumbnail || item.uri }}
                style={styles.statusThumbImg}
            />
            {isVideo && (
                <View style={styles.playBadge}>
                    <Ionicons name="play" size={10} color="#fff" />
                </View>
            )}
            <TouchableOpacity style={styles.removeBtn} onPress={() => onRemove(item.uri)}>
                <Ionicons name="close-circle" size={18} color="#ff3b30" />
            </TouchableOpacity>
        </View>
    );
};

// ── Main Screen ───────────────────────────────────────────────────────────────
const AvatarScreen = ({ navigation }) => {
    const { t } = useTranslation();
    const { theme } = useContext(ThemeContext);
     const dispatch  = useDispatch();
    const maniAllData = useSelector((state) => state.totalappData);
    console.log(maniAllData);
    const MY_USER_ID  = maniAllData?.userId ?? '';
    const userData    = maniAllData?.user ?? null;

    const [profileUri,   setProfileUri]   = useState(null);
    const [profileLoading, setProfileLoading] = useState(false);

    const [statusItems,  setStatusItems]  = useState([]);   // { uri, type, thumbnail? }
    const [statusLoading, setStatusLoading] = useState(false);

    const isDark = theme?.mode === 'dark';
    const bg     = isDark ? '#121212' : '#f5f7fa';
    const card   = isDark ? '#1e1e1e' : '#ffffff';
    const txt    = isDark ? '#f0f0f0' : '#1a1a1a';
    const sub    = isDark ? '#999'    : '#888';

    // ── Profile photo ─────────────────────────────────────────────────────────
    const handleProfileSource = (source) => {
        Alert.alert('Profile Photo', 'Choose source', [
            {
                text: 'Camera', onPress: async () => {
                    const assets = await pickFromCamera(ImagePicker.MediaTypeOptions.Images);
                    if (assets) setProfileUri(assets[0].uri);
                }
            },
            {
                text: 'Gallery', onPress: async () => {
                    const assets = await pickMedia(ImagePicker.MediaTypeOptions.Images);
                    if (assets) setProfileUri(assets[0].uri);
                }
            },
            { text: 'Cancel', style: 'cancel' },
        ]);
    };

    const uploadProfile = async () => {
        if (!profileUri) return Alert.alert('No photo selected', 'Please pick a profile photo first.');
        setProfileLoading(true);
        try {
            const formData = new FormData();
            await appendFile(formData, 'profilePicture', {
                uri: profileUri,
                name: 'profile.jpg',
                type: 'image/jpeg',
            });
            const res = await apiService({
                method: 'PUT',
                endpoint: 'users/profile',
                data: formData,
                isMultipart:true
                
            });
            console.log("res_____-----------_",res)
            if(res?.success){
                updateUserInStore(res?.data?.user)
            }
        } catch (e) {
            console.error(e);
            Alert.alert('Error', 'Failed to upload profile photo.');
        } finally {
            setProfileLoading(false);
        }
    };

     const updateUserInStore = (newUserData) => {
            dispatch(
                settotalappData({
                ...maniAllData,   
                user: newUserData,            
                })
            );
    };

   
    // ─────────────────────────────────────────────────────────────────────────
    return (
        <SafeAreaView style={[styles.container, { backgroundColor: bg }]}>
            <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color="#fff" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Edit profile image</Text>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>

                {/* ── Profile Photo Card ── */}
                <View style={[styles.card, { backgroundColor: card }]}>
                    <Text style={[styles.sectionTitle, { color: txt }]}>Profile Photo</Text>
                    <Text style={[styles.sectionSub, { color: sub }]}>Your profile photo is visible to all contacts</Text>

                    <View style={styles.profileRow}>
                        <TouchableOpacity onPress={handleProfileSource} style={styles.avatarWrap} activeOpacity={0.8}>
                            {profileUri ? (
                                <Image source={{ uri: profileUri }} style={styles.avatarPreview} />
                            ) : (
                                <View style={[styles.avatarPlaceholder, { backgroundColor: isDark ? '#2a2a2a' : '#f0f4ff' }]}>
                                    <Ionicons name="person" size={44} color="#0084ff" />
                                </View>
                            )}
                            <View style={styles.editBadge}>
                                <Ionicons name="camera" size={14} color="#fff" />
                            </View>
                        </TouchableOpacity>

                        <View style={styles.profileBtns}>
                            <TouchableOpacity style={styles.sourceBtn} onPress={() => pickFromCamera(ImagePicker.MediaTypeOptions.Images).then(a => a && setProfileUri(a[0].uri))}>
                                <Ionicons name="camera-outline" size={18} color="#0084ff" />
                                <Text style={styles.sourceBtnText}>Camera</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.sourceBtn} onPress={() => pickMedia(ImagePicker.MediaTypeOptions.Images).then(a => a && setProfileUri(a[0].uri))}>
                                <Ionicons name="images-outline" size={18} color="#0084ff" />
                                <Text style={styles.sourceBtnText}>Gallery</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    <TouchableOpacity
                        style={[styles.uploadBtn, profileLoading && { opacity: 0.7 }]}
                        onPress={uploadProfile}
                        disabled={profileLoading}
                    >
                        {profileLoading
                            ? <ActivityIndicator color="#fff" size="small" />
                            : <><Ionicons name="cloud-upload-outline" size={18} color="#fff" /><Text style={styles.uploadBtnText}>Save Profile Photo</Text></>
                        }
                    </TouchableOpacity>
                </View>

            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        height: 80, backgroundColor: '#0084ff',
        flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16,paddingTop:25
    },
    backBtn:     { marginRight: 14 },
    headerTitle: { color: '#fff', fontSize: 20, fontWeight: '700' },

    card: {
        margin: 16, marginBottom: 0,
        borderRadius: 18, padding: 20,
        shadowColor: '#000', shadowOpacity: 0.06,
        shadowOffset: { width: 0, height: 2 }, shadowRadius: 8,
        elevation: 3,
    },
    sectionTitle: { fontSize: 17, fontWeight: '700', marginBottom: 4 },
    sectionSub:   { fontSize: 12, marginBottom: 20, lineHeight: 18 },

    // Profile
    profileRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
    avatarWrap:  { position: 'relative', marginRight: 20 },
    avatarPreview: { width: 90, height: 90, borderRadius: 45 },
    avatarPlaceholder: {
        width: 90, height: 90, borderRadius: 45,
        alignItems: 'center', justifyContent: 'center',
    },
    editBadge: {
        position: 'absolute', bottom: 2, right: 2,
        width: 26, height: 26, borderRadius: 13,
        backgroundColor: '#0084ff',
        alignItems: 'center', justifyContent: 'center',
        borderWidth: 2, borderColor: '#fff',
    },
    profileBtns: { gap: 10 },
    sourceBtn: {
        flexDirection: 'row', alignItems: 'center', gap: 8,
        borderWidth: 1.5, borderColor: '#0084ff',
        paddingHorizontal: 16, paddingVertical: 8,
        borderRadius: 10,
    },
    sourceBtnText: { color: '#0084ff', fontSize: 14, fontWeight: '600' },

    uploadBtn: {
        backgroundColor: '#0084ff', borderRadius: 12,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        paddingVertical: 13, gap: 8,
    },
    uploadBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },

    // Status
    statusGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 14 },
    statusThumb: { width: 72, height: 72, borderRadius: 12, overflow: 'visible', position: 'relative' },
    statusThumbImg: { width: 72, height: 72, borderRadius: 12 },
    playBadge: {
        position: 'absolute', bottom: 6, left: 6,
        backgroundColor: 'rgba(0,0,0,0.55)',
        borderRadius: 8, paddingHorizontal: 5, paddingVertical: 2,
    },
    removeBtn: { position: 'absolute', top: -6, right: -6 },

    addMediaBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        borderWidth: 1.5, borderStyle: 'dashed', borderRadius: 12,
        paddingVertical: 14, gap: 8, marginBottom: 14,
    },
    addMediaText: { fontSize: 15, fontWeight: '600' },

    statsRow:  { flexDirection: 'row', gap: 10, marginBottom: 16 },
    statBadge: {
        flexDirection: 'row', alignItems: 'center', gap: 5,
        backgroundColor: '#f0f4ff', paddingHorizontal: 10, paddingVertical: 5,
        borderRadius: 20,
    },
    statText: { fontSize: 12, color: '#444', fontWeight: '500' },
});
export default AvatarScreen;