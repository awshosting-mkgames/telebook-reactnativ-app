import React, { useState, useContext } from 'react';
import {
    StyleSheet, Text, View, Image, ScrollView,
    TouchableOpacity, Switch, FlatList, Dimensions
} from 'react-native';
import { Ionicons, MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemeContext } from '../../components/ThemeContext';
const { width } = Dimensions.get('window');

const Group = ({ navigation }) => {
     const { theme, toggleTheme } = useContext(ThemeContext);
    // Mock Data for Members
    const members = [
        { id: '1', name: 'You', status: 'Available', isAdmin: true, img: 'https://i.pravatar.cc/100?u=1' },
        { id: '2', name: 'Kenny Payne', status: 'Busy', img: 'https://i.pravatar.cc/100?u=2' },
        { id: '3', name: 'Anthony LaRusso', status: 'Miyagi-Do 🥋', img: 'https://i.pravatar.cc/100?u=3' },
        { id: '4', name: 'Eli Moskowitz', status: 'I am busy all time', img: 'https://i.pravatar.cc/100?u=4' },
        { id: '5', name: 'Johnny Lawrence', status: 'Cobra kai 🐍', img: 'https://i.pravatar.cc/100?u=5' },
    ];

    // Action Button Component
    const ActionBtn = ({ icon, label, type = "Ionicons" }) => (
        <TouchableOpacity style={styles.actionBtn}>
            <View style={styles.actionIconCircle}>
                {type === "Ionicons" ? <Ionicons name={icon} size={22} color="#3498db" /> : <Feather name={icon} size={22} color="#3498db" />}
            </View>
            <Text style={styles.actionLabel}>{label}</Text>
        </TouchableOpacity>
    );

    return (
        <SafeAreaView style={[styles.container,{ backgroundColor: theme.background}]}>
            {/* HEADER BAR */}
           <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <Ionicons name="arrow-back" size={24} color="white" />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => navigation.navigate('Settings')}>
                    <Ionicons name="filter-sharp" size={26} color="white" />
                </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={styles.content}>

                {/* PROFILE HEADER */}
                <View style={styles.profileHeader}>
                    <Image source={{ uri: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=800'  }} style={styles.groupAvatar} />
                    <Text style={[styles.groupName,{ color: theme.text}]}>Queen Jewelry & Accessories</Text>
                    <Text style={styles.groupSub}>Group • 250 member</Text>

                    {/* QUICK ACTIONS */}
                    <View style={styles.actionRow}>
                        <ActionBtn icon="call-outline" label="Audio" />
                        <ActionBtn icon="videocam-outline" label="Video" />
                        <ActionBtn icon="person-add-outline" label="Add" />
                        <ActionBtn icon="search" label="Search" />
                    </View>
                </View>

                <View style={styles.divider} />

                {/* DESCRIPTION SECTION */}
                <TouchableOpacity style={styles.sectionPadding}>
                    <Text style={styles.blueText}>Add group description</Text>
                    <Text style={styles.grayText}>Created by You, 4/11/25</Text>
                </TouchableOpacity>

                <View style={styles.divider} />

                {/* MEDIA SECTION */}
                <View style={styles.sectionPadding}>
                    <View style={styles.rowBetween}>
                        <Text style={[styles.sectionTitle,{ color: theme.text}]}>Media, links, and docs</Text>
                        <View style={styles.row}>
                            <Text style={styles.grayText}>15K </Text>
                            <Ionicons name="chevron-forward" size={16} color={theme.text} />
                        </View>
                    </View>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.mediaRow}>
                        {[1, 2, 3, 4, 5].map((i) => (
                            <Image key={i} source={{ uri: `https://picsum.photos/200/200?random=${i}` }} style={styles.mediaThumb} />
                        ))}
                    </ScrollView>
                </View>

                <View style={styles.divider} />

                {/* SETTINGS */}
                <TouchableOpacity style={styles.settingItem}>
                    <View style={[styles.iconBox, { backgroundColor: '#3498db' }]}>
                        <Ionicons name="notifications" size={20} color="white" />
                    </View>
                    <View style={styles.flex1}>
                        <Text style={[styles.settingTitle,{color :  theme.text}]}>Notifications</Text>
                        <Text style={styles.grayText}>All</Text>
                    </View>
                </TouchableOpacity>

                <TouchableOpacity style={styles.settingItem}>
                    <View style={[styles.iconBox, { backgroundColor: '#3498db' }]}>
                        <MaterialCommunityIcons name="chat-lock" size={20} color="white" />
                    </View>
                    <View style={styles.flex1}>
                        <Text style={[styles.settingTitle,{color :  theme.text}]}>Chat lock</Text>
                        <Text style={styles.grayText}>Lock and hide this chat on this device.</Text>
                    </View>
                    <Switch value={false} trackColor={{ false: "#ddd", true: "#3498db" }} />
                </TouchableOpacity>

                <View style={styles.divider} />

                {/* MEMBERS LIST */}
                <View style={styles.sectionPadding}>
                    <View style={styles.rowBetween}>
                        <Text style={styles.sectionTitle}>5 member</Text>
                        <Ionicons name="search" size={20} color="#555" />
                    </View>
                </View>

                <TouchableOpacity style={styles.memberRow}>
                    <View style={[styles.iconBox, { backgroundColor: '#3498db', borderRadius: 25 }]}>
                        <Ionicons name="person-add" size={20} color="white" />
                    </View>
                    <Text style={[styles.memberAddText,{color:theme.color}]}>Add members</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.memberRow}>
                    <View style={[styles.iconBox, { backgroundColor: '#3498db', borderRadius: 25 }]}>
                        <Ionicons name="link" size={20} color="white" />
                    </View>
                    <Text style={[styles.memberAddText,{color:theme.color}]}>Invite via group link</Text>
                </TouchableOpacity>

                {members.map(item => (
                    <View key={item.id} style={styles.memberRow}>
                        <Image source={{ uri: item.img }} style={styles.memberAvatar} />
                        <View style={styles.flex1}>
                            <Text style={[styles.memberName,{color:theme.text}]}>{item.name}</Text>
                            <Text style={styles.grayText}>{item.status}</Text>
                        </View>
                        {item.isAdmin && (
                            <View style={styles.adminBadge}><Text style={styles.adminText}>Group Admin</Text></View>
                        )}
                    </View>
                ))}

                <TouchableOpacity style={styles.viewAllBtn}>
                    <Text style={styles.viewAllText}>View all (250 more)</Text>
                </TouchableOpacity>

                <View style={styles.divider} />

                {/* FOOTER ACTIONS */}
                <TouchableOpacity style={styles.footerItem}>
                    <TouchableOpacity style={styles.footerIconCircle}>
                        <Ionicons name="heart" size={18} color="#ffffff" />
                    </TouchableOpacity>
                    <Text style={[styles.footerText,{color:theme.text}]}>Add to Favorites</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.footerItem}>
                    <TouchableOpacity style={{...styles.footerIconCircle,backgroundColor: '#ff1900'}}>
                       <MaterialCommunityIcons name="exit-to-app" size={18} color="#ffffff" />
                    </TouchableOpacity>
                    <Text style={[styles.footerText, { color: '#e74c3c' }]}>Exit group</Text>
                </TouchableOpacity>

            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: 'white' },
    headerBar: { height: 60, backgroundColor: '#3498db', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 15 },
    content: { flex: 1 },
     header: {
        height: 60, backgroundColor: '#3498db',
        flexDirection: 'row', alignItems: 'center',
        justifyContent: 'space-between', paddingHorizontal: 15
    },
    profileHeader: { alignItems: 'center', paddingVertical: 25 },
    groupAvatar: { width: 110, height: 110, borderRadius: 55, backgroundColor: '#eee' },
    groupName: { fontSize: 16, fontWeight: 'bold', marginTop: 15 },
    groupSub: { fontSize: 13, color: '#727272' , marginTop: 4 },
    actionRow: { flexDirection: 'row', marginTop: 20, width: '90%', justifyContent: 'space-around' },
    actionBtn: { width: '22%', height: 60, borderRadius: 12, borderWidth: 1, borderColor: '#eee', justifyContent: 'center', alignItems: 'center',  },
    actionIconCircle: { marginBottom: 5 },
    actionLabel: { fontSize: 14, color: '#555' },
    divider: { height: 8, backgroundColor: '#f6f6f6', marginVertical: 5 },
    sectionPadding: { padding: 15 },
    blueText: { color: '#3498db', fontSize: 17, fontWeight: '400',marginBottom: 8 },
    grayText: { color: '#9f9f9f', fontSize: 15,  fontWeight: '400',marginTop: 5 },
    sectionTitle: { fontSize: 17, fontWeight: '400', color: '#333' },
    rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    row: { flexDirection: 'row', alignItems: 'center' },
    mediaRow: { marginTop: 15, flexDirection: 'row' },
    mediaThumb: { width: 70, height: 70, borderRadius: 10, marginRight: 10 },
    settingItem: { flexDirection: 'row', alignItems: 'center', padding: 15 },
    iconBox: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
    flex1: { flex: 1 },
    settingTitle: { fontSize: 17, fontWeight: '600',color: '#000000' },
    memberRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, paddingVertical: 10 },
    memberAvatar: { width: 45, height: 45, borderRadius: 22.5, marginRight: 15 },
    memberName: { fontSize: 17, fontWeight: '600' },
    memberAddText: { fontSize: 17, color: '#333', fontWeight: '500' },
    adminBadge: { backgroundColor: '#e1f5fe', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 5 },
    adminText: { color: '#3498db', fontSize: 15, fontWeight: 'bold' },
    viewAllBtn: { backgroundColor: '#e1f5fe', paddingVertical: 10, paddingHorizontal: 25, borderRadius: 20, alignSelf: 'center', marginVertical: 15 },
    viewAllText: { color: '#3498db', fontWeight: '500', fontSize: 15 },
    footerItem: { flexDirection: 'row',padding:10, alignItems: 'center', justifyContent: 'flex-start', marginBottom: 10 },
    footerIconCircle: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', backgroundColor: '#3498db',marginRight: 5 },
    footerText: { fontSize: 18, fontWeight: '600', marginLeft: 10 }
});

export default Group;