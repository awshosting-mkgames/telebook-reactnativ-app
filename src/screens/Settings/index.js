import React from 'react';
import {
    StyleSheet,
    Text,
    View,
    Image,
    TouchableOpacity,
    ScrollView,
    SafeAreaView,
    StatusBar
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const SettingsItem = ({ icon, title, subtitle, iconColor = "#3498db" }) => (
    <TouchableOpacity style={styles.itemContainer}>
        <View style={[styles.iconContainer, { backgroundColor: iconColor }]}>
            <Ionicons name={icon} size={22} color="white" />
        </View>
        <View style={styles.textContainer}>
            <Text style={styles.itemTitle}>{title}</Text>
            {subtitle && <Text style={styles.itemSubtitle}>{subtitle}</Text>}
        </View>
    </TouchableOpacity>
);

export default function Settings({ navigation }) {
    const menuItems = [
        { id: '1', icon: 'key-outline', title: 'Account', subtitle: 'Security notifications, change number' },
        { id: '2', icon: 'lock-closed-outline', title: 'Account', subtitle: 'Block contacts, disappearing messages' },
        { id: '3', icon: 'person-circle-outline', title: 'Avatar', subtitle: 'Create, edit, profile photo' },
        { id: '4', icon: 'people-outline', title: 'Lists', subtitle: 'Manage people and groups' },
        { id: '5', icon: 'chatbubble-outline', title: 'Chats', subtitle: 'Theme, wallpaper, chat history' },
        { id: '6', icon: 'notifications-outline', title: 'Notifications', subtitle: 'Message, group & call tones' },
        { id: '7', icon: 'stats-chart-outline', title: 'Storage and data', subtitle: 'Network usage, auto-download' },
        { id: '8', icon: 'globe-outline', title: 'App language', subtitle: "English (device's language)" },
        { id: '9', icon: 'help-circle-outline', title: 'Help', subtitle: 'Help center, contact us, privacy policy' },
        { id: '10', icon: 'people', title: 'Invite a friend', subtitle: null },
    ];

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="light-content" />

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity style={styles.headerLeft} onPress={() => navigation.goBack()}>
                    <Ionicons name="arrow-back" size={24} color="white" />
                    <Text style={styles.headerTitle}>Setting</Text>
                </TouchableOpacity>
                <Ionicons name="search" size={24} color="white" />
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
                {/* Ad Banner */}
                <View style={styles.adBanner}>
                    <View style={styles.adIconCircle}>
                        <Ionicons name="megaphone-outline" size={20} color="#0084ff" />
                    </View>
                    <View style={styles.adContent}>
                        <Text style={styles.adTitle}>Create ads from ₹88.025/day</Text>
                        <Text style={styles.adSubtitle}>
                            Reach potential new customers with an ad that lets people start FreeApp chats with you.
                            <Text style={styles.linkText}> Get started</Text>
                        </Text>
                    </View>
                    <TouchableOpacity>
                        <Ionicons name="close" size={20} color="#555" />
                    </TouchableOpacity>
                </View>

                {/* Profile Section */}
                <View style={styles.profileSection}>
                    <Image
                        source={{ uri: 'https://avatar.iran.liara.run/public/boy?username=Daniel' }}
                        style={styles.avatar}
                    />
                    <View style={styles.profileInfo}>
                        <Text style={styles.profileName}>Daniel LaRusso</Text>
                        <Text style={styles.profileBio}>Miyagi-Do 🥋</Text>
                    </View>
                    <View style={styles.profileActions}>
                        <Ionicons name="qr-code-outline" size={22} color="#0084ff" />
                        <Ionicons name="add-circle" size={22} color="#0084ff" style={{ marginLeft: 10 }} />
                    </View>
                </View>

                {/* Settings List */}
                <View style={styles.listSection}>
                    {menuItems.map((item) => (
                        <SettingsItem
                            key={item.id}
                            icon={item.icon}
                            title={item.title}
                            subtitle={item.subtitle}
                        />
                    ))}
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    header: {
        backgroundColor: '#0084ff',
        height: 60,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 15,
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    headerTitle: {
        color: 'white',
        fontSize: 20,
        fontWeight: '600',
        marginLeft: 20,
    },
    adBanner: {
        backgroundColor: '#ebf5ff',
        margin: 15,
        borderRadius: 12,
        padding: 15,
        flexDirection: 'row',
    },
    adIconCircle: {
        width: 35,
        height: 35,
        borderRadius: 17.5,
        backgroundColor: 'white',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    adContent: {
        flex: 1,
        marginRight: 10,
    },
    adTitle: {
        fontWeight: 'bold',
        fontSize: 11,
        color: '#333',
    },
    adSubtitle: {
        fontSize: 9,
        color: '#666',
        marginTop: 4,
        lineHeight: 16,
    },
    linkText: {
        color: '#0084ff',
    },
    profileSection: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 15,
    },
    avatar: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: '#eee',
    },
    profileInfo: {
        flex: 1,
        marginLeft: 15,
    },
    profileName: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#333',
    },
    profileBio: {
        fontSize: 12,
        color: '#888',
        marginTop: 2,
    },
    profileActions: {
        flexDirection: 'row',
    },
    listSection: {
        marginTop: 10,
    },
    itemContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 20,
    },
    iconContainer: {
        width: 38,
        height: 38,
        borderRadius: 19,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 15,
    },
    textContainer: {
        flex: 1,
    },
    itemTitle: {
        fontSize: 14,
        color: '#333',
        fontWeight: '500',
    },
    itemSubtitle: {
        fontSize: 11,
        color: '#888',
        marginTop: 2,
    },
});