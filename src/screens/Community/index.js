import React, { useState, useContext } from 'react';
import {
    StyleSheet, Text, View, Image, ScrollView,
    TouchableOpacity, Switch, FlatList,StatusBar,Platform
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons, MaterialCommunityIcons, Octicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemeContext } from '../../components/ThemeContext';

const Community = ({ navigation }) => {
    const { t } = useTranslation();
    const { theme, toggleTheme } = useContext(ThemeContext);
    const members = [
        { id: '1', name: 'You', status: 'Available', img: 'https://i.pravatar.cc/100?u=1' },
        { id: '2', name: 'Kenny Payne', status: 'Busy', isAdmin: true, img: 'https://i.pravatar.cc/100?u=2' },
        { id: '3', name: 'Anthony LaRusso', status: 'Miyagi-Do 🥋', img: 'https://i.pravatar.cc/100?u=3' },
        { id: '4', name: 'Eli Moskowitz', status: 'I am busy all time', img: 'https://i.pravatar.cc/100?u=4' },
        { id: '5', name: 'Johnny Lawrence', status: 'Cobra kai 🐍', img: 'https://i.pravatar.cc/100?u=5' },
    ];

    const gotogroupPage = () => {
        navigation.navigate('Group');
    }

    const SettingItem = ({ icon, name, subText, hasSwitch, color = "#3498db" }) => (
        <TouchableOpacity style={styles.settingRow}>
            <View style={[styles.iconBox, { backgroundColor: color }]}>
                <Ionicons name={icon} size={16} color="white" />
            </View>
            <View style={styles.settingTextContainer}>
                <Text style={[styles.settingName,{ color: theme.text}]}>{name}</Text>
                {subText && <Text style={styles.settingSub}>{subText}</Text>}
            </View>
            {hasSwitch ? <Switch value={false} trackColor={{ false: "#ddd", true: "#3498db" }} /> : null}
        </TouchableOpacity>
    );

    return (
        <SafeAreaView style={[styles.container,{ backgroundColor: theme.background}]}>
            {/* HEADER */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <Ionicons name="arrow-back" size={24} color="white" />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => navigation.navigate('Settings')}>
                    <Ionicons name="filter-sharp" size={26} color="white" />
                </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
                {/* PROFILE SECTION */}
                <View style={styles.profileSection}>
                    <Image
                        source={{ uri: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=800' }}
                        style={styles.mainAvatar}
                    />
                    <Text style={[styles.communityName,{ color: theme.text}]}>Queen Jewelry & Accessories</Text>
                    <Text style={styles.communitySub}>Group in Queen Jewelry Add 1</Text>
                    <Text style={styles.memberCount}>Group • 250 member</Text>

                    <View style={styles.actionRow}>
                        <TouchableOpacity style={styles.actionBtn}>
                            <Ionicons name="chatbubble-ellipses-outline" size={20} color="#999" />
                            <Text style={styles.actionText}>Voice Chat</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.actionBtn}>
                            <Ionicons name="search" size={20} color="#3498db" />
                            <Text style={[styles.actionText]}>Search</Text>
                        </TouchableOpacity>
                    </View>
                </View>
                     <View style={[styles.divider,{backgroundColor: theme.dividerColor}]} />
                {/* COMMUNITY LINK */}
                <TouchableOpacity onPress={gotogroupPage} style={styles.communityLink}>
                    <Image source={{ uri: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=800' }} style={styles.smallIcon} />
                    <View style={{ flex: 1, marginLeft: 10 }}>
                        <Text style={[styles.settingName,{ color: theme.text}]}>Queen Jewelry</Text>
                        <Text style={styles.settingSub}>Community • 8 group</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color="#ccc" />
                </TouchableOpacity>

                <View style={[styles.divider,{backgroundColor: theme.dividerColor}]} />

                {/* SETTINGS LIST */}
                <SettingItem icon="notifications" name="Notifications" subText="All" />
                <SettingItem icon="eye" name="Media visibility" />
                <SettingItem icon="lock-closed" name="Encryption" subText="Messages and calls are end-to-end encrypted." />
                <SettingItem icon="time" name="Disappearing messages" subText="7 Days" />
                <SettingItem icon="chatbubble-ellipses" name="Chat lock" subText="Lock and hide this chat on this device." hasSwitch={true} />
                <SettingItem icon="shield-checkmark" name="Advanced Chat Privacy" subText="Off" />

                <View style={[styles.divider,{backgroundColor: theme.dividerColor}]} />

                {/* MEMBERS SECTION */}
                <View style={styles.memberHeader}>
                    <Text style={[styles.memberHeaderTitle,{ color: theme.text}]}>250 member</Text>
                    <Ionicons name="search" size={17} color={theme.text} />
                </View>

                {members.map(item => (
                    <View key={item.id} style={styles.memberRow}>
                        <Image source={{ uri: item.img }} style={styles.memberImg} />
                        <View style={{ flex: 1, marginLeft: 15 }}>
                            <Text style={[styles.memberName,{ color: theme.text}]}>{item.name}</Text>
                            <Text style={styles.memberStatus}>{item.status}</Text>
                        </View>
                        {item.isAdmin && (
                            <View style={[styles.adminBadge,{backgroundColor:theme.batchColor}]}>
                                <Text style={styles.adminText}>Group Admin</Text>
                            </View>
                        )}
                    </View>
                ))}

                <TouchableOpacity style={[styles.viewAllBtn,{backgroundColor:theme.batchColor}]}>
                    <Text style={styles.viewAllText}>View all (250 more)</Text>
                </TouchableOpacity>

                 <View style={[styles.divider,{backgroundColor: theme.dividerColor}]} />

                {/* FOOTER ACTIONS */}
                <TouchableOpacity style={styles.footerItem}>
                    <View style={[styles.iconBox, { backgroundColor:  '#3498db'  }]}>
                        <Ionicons name="heart-outline" size={16} color="#ffffff" />
                    </View>
                    <Text style={[styles.footerText,{ color: theme.text}]}>Add to Favorites</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.footerItem}>
                    <View style={[styles.iconBox, { backgroundColor: '#3498db' }]}>
                        <MaterialCommunityIcons name="playlist-plus" size={16} color="#ffffff" />
                    </View>
                    <Text style={[styles.footerText,{ color: theme.text}]}>Add to list</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.footerItem}>
                    <View style={[styles.iconBox, { backgroundColor:  '#f60606'  }]}>
                        <MaterialCommunityIcons name="exit-to-app" size={16} color="#ffffff" />
                    </View>
                    <Text style={[styles.footerText, { color: '#e74c3c' }]}>Exit group</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.footerItem}>
                    <View style={[styles.iconBox, { backgroundColor:  '#f60606'  }]}>
                        <MaterialCommunityIcons name="thumb-down-outline" size={16} color="#ffffff" />
                    </View>
                    <Text style={[styles.footerText, { color: '#e74c3c' }]}>Report group</Text>
                </TouchableOpacity>
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: 'white' },
    header: {
        height: 60, backgroundColor: '#3498db',
        flexDirection: 'row', alignItems: 'center',
        justifyContent: 'space-between', paddingHorizontal: 15
    },
    profileSection: { alignItems: 'center', paddingVertical: 20 },
    mainAvatar: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#333' },
    communityName: { fontSize: 18, fontWeight: '400', marginTop: 15 },
    communitySub: { fontSize: 12, color: '#999', marginTop: 5 },
    memberCount: { fontSize: 12, color: '#999', marginTop: 3 },
    actionRow: { flexDirection: 'row', marginTop: 20 },
    actionBtn: {
        alignItems: 'center',
        borderWidth: 1, borderColor: '#c4c4c4',
        width: 140, paddingVertical: 18,
        borderRadius: 10, marginHorizontal: 5
    },
    actionText: { marginLeft: 8, fontWeight: '400', color: '#999',marginTop: 10 },
    communityLink: {
        flexDirection: 'row', alignItems: 'center',
        padding: 15, 
    },
    smallIcon: { width: 40, height: 40, borderRadius: 8 },
    divider: { height: 10, backgroundColor: '#f5f5f5' },
    settingRow: {
        flexDirection: 'row', alignItems: 'center',
        padding: 15, borderBottomWidth: 0.5, borderBottomColor: '#f0f0f0'
    },
    iconBox: { width: 34, height: 34, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
    settingTextContainer: { flex: 1, marginLeft: 15 },
    settingName: { fontSize: 15, color: '#424242' ,fontWeight: '400'},
    settingSub: { fontSize: 12, color: '#a8a8a8' ,fontWeight: '400',marginTop: 5},
    memberHeader: { flexDirection: 'row', justifyContent: 'space-between', padding: 15 },
    memberHeaderTitle: { fontWeight: '400', color: '#555',fontSize: 16 },
    memberRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, paddingVertical: 10 },
    memberImg: { width: 35, height: 35, borderRadius: 22.5 },
    memberName: { fontWeight: '500', fontSize: 15 },
    memberStatus: { fontSize: 12, color: 'gray' },
    adminBadge: { backgroundColor: '#d1f2ff', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 5 },
    adminText: { color: '#3498db', fontSize: 10 , fontWeight: 'bold' },
    viewAllBtn: {
        backgroundColor: '#d1f2ff', alignSelf: 'center',
        paddingHorizontal: 22, paddingVertical: 8,
        borderRadius: 20, marginVertical: 20
    },
    viewAllText: { color: '#3498db', fontWeight: '600',fontSize: 15 },
    footerItem: { flexDirection: 'row', alignItems: 'center', padding: 15 },
    footerText: { marginLeft: 15, fontSize: 16, fontWeight: '500', color: '#333' }
});

export default Community;