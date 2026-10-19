// components/SubCard.js
import React, { useContext } from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { ThemeContext } from '../../../components/ThemeContext';
import Config from '../../../services/config';

const getImg = (path) => {
    if (!path) return null;
    if (typeof path === 'string' && path.startsWith('http')) return path;
    return `${Config.MEDIA_URL}${path}`;
};

export default function SubCard({ item }) {
    const { t } = useTranslation();

    const { theme } = useContext(ThemeContext);
    const isLight = theme?.mode === 'light';
    const styles = getStyles(isLight);

    return (
        <View style={styles.row}>
            {item?.profilePicture
                ? <Image source={{ uri: getImg(item.profilePicture) }} style={styles.avatar} />
                : <View style={[styles.avatar, styles.avatarFb]}>
                    <Ionicons name="person" size={22} color={isLight ? '#bbb' : '#6b6f76'} />
                </View>
            }
            <View style={{ flex: 1 }}>
                <Text style={styles.name}>{item?.name || item?.mobile || 'User'}</Text>
                {item?.mobile && <Text style={styles.mobile}>{item.mobile}</Text>}
            </View>

        </View>
    );
}

const getStyles = (isLight) => StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: isLight ? '#f5f5f5' : '#22252b', backgroundColor: isLight ? '#fff' : '#1a1d23', gap: 12 },
    avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: isLight ? '#f0f0f0' : '#2a2d33' },
    avatarFb: { alignItems: 'center', justifyContent: 'center' },
    name: { fontSize: 15, fontWeight: '600', color: isLight ? '#111' : '#f5f5f5' },
    mobile: { fontSize: 13, color: isLight ? '#aaa' : '#8a8f96', marginTop: 2 },
    chip: { backgroundColor: isLight ? '#e8f4fd' : '#16324a', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
    chipTxt: { color: '#1296f3', fontSize: 12, fontWeight: '600' },
});