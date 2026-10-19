import React, { useState, useContext } from 'react';
import {
    StyleSheet,
    Text,
    View,
    TextInput,
    TouchableOpacity,
    FlatList,
    SafeAreaView,
    StatusBar,Platform,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { ThemeContext } from '../../components/ThemeContext';



export default function InviteAFriends({navigation}) {
     const { t } = useTranslation();
    const { theme, toggleTheme } = useContext(ThemeContext);
    const contacts = [
        { id: '1', name: 'Alexander', phone: '+44 1836 822222' },
        { id: '2', name: 'Kenny', phone: '+44 1975 985465' },
        { id: '3', name: 'Wall Walker', phone: '+86 185 8020 4015' },
        { id: '4', name: 'Jemi Anderson', phone: '+81 70-2185-5995' },
        { id: '5', name: 'Yash', phone: '+91 85457 74125' },
        { id: '6', name: 'Virat Kohli', phone: '+91 95223 58421' },
        { id: '7', name: 'KL Rahul', phone: '+91 91918 58584' },
        { id: '8', name: 'Sachin Tendulkar', phone: '+91 63635 53538' },
    ];
    const gotocontactpage = () => {
        navigation.navigate('Contact');
    }
    const InviteItem = ({ item }) => (
        <View style={styles.contactItem}>

            <View style={styles.avatarContainer}>
                <Ionicons name="person" size={30} color="#999" />
            </View>
            <View style={styles.contactInfo}>
                <Text style={[styles.contactName,{ color: theme.text}]}>{item.name}</Text>
                <Text style={styles.contactPhone}>{item.phone}</Text>
            </View>
            <TouchableOpacity style={styles.inviteButton}>
                <Text style={styles.inviteButtonText}>Invite</Text>
            </TouchableOpacity>
        </View>
    );
    const ListHeader = () => (
        <View>
            {/* Search Bar */}
            <View style={styles.searchSection}>
                <View style={styles.searchBar}>
                    <Ionicons name="search" size={20} color="#666" style={styles.searchIcon} />
                    <TextInput
                        placeholder="Search name or number"
                        style={styles.searchInput}
                        placeholderTextColor="#999"
                    />
                </View>
            </View>

            {/* Share Link Row */}
            <TouchableOpacity onPress={gotocontactpage} style={styles.shareLinkContainer}>
                <View style={[styles.shareIconCircle,{backgroundColor:theme.text}]}>
                    <Ionicons name="share-social" size={20} color={theme.background} />
                </View>
                <Text style={[styles.shareLinkText,{ color: theme.text}]}>Share Link</Text>
            </TouchableOpacity>

            {/* Section Header */}
            <View style={styles.sectionHeader}>
                <Text style={styles.sectionHeaderText}>From Contacts</Text>
            </View>
        </View>
    );

    return (
        <SafeAreaView style={[styles.container,{ backgroundColor: theme.background}]}>
             <StatusBar backgroundColor={theme.header || '#1199ff'} barStyle="light-content" />

            {/* Header */}
            <View style={[styles.header, { backgroundColor: theme.header || '#1199ff' }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Ionicons name="arrow-back" size={26} color="white" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Invite a Friends</Text>
            </View>

            <FlatList
                data={contacts}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => <InviteItem item={item} />}
                ListHeaderComponent={ListHeader}
                showsVerticalScrollIndicator={false}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    header: {
        backgroundColor: '#4491f2',
        height: 90,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 15,
        paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
    },
    headerTitle: {
        color: 'white',
        fontSize: 20,
        fontWeight: '500',
        marginLeft: 25,
    },
    searchSection: {
        padding: 15,
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f1f1f1',
        borderRadius: 25,
        paddingHorizontal: 15,
        height: 45,
    },
    searchIcon: {
        marginRight: 10,
    },
    searchInput: {
        flex: 1,
        fontSize: 16,
    },
    shareLinkContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 10,
    },
    shareIconCircle: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#000',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 15,
    },
    shareLinkText: {
        fontSize: 16,
        fontWeight: '500',
        color: '#000',
    },
    sectionHeader: {
        paddingHorizontal: 20,
        paddingVertical: 15,
    },
    sectionHeaderText: {
        fontSize: 12,
        color: '#888',
    },
    contactItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderBottomWidth: 0.5,
        borderBottomColor: '#f0f0f0',
    },
    avatarContainer: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: '#eee',
        justifyContent: 'center',
        alignItems: 'center',
    },
    contactInfo: {
        flex: 1,
        marginLeft: 15,
    },
    contactName: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#000',
    },
    contactPhone: {
        fontSize: 14,
        color: '#666',
        marginTop: 2,
    },
    inviteButton: {
        backgroundColor: '#4491f2',
        paddingHorizontal: 20,
        paddingVertical: 8,
        borderRadius: 20,
    },
    inviteButtonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: '600',
    },
});