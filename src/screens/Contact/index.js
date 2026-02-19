import React, { useState, useContext } from 'react';
import {
    StyleSheet,
    Text,
    View,
    TextInput,
    Image,
    TouchableOpacity,
    FlatList,
    SafeAreaView,
    StatusBar,Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ThemeContext } from '../../components/ThemeContext';



export default function Contact({ navigation }) {
     const { theme, toggleTheme } = useContext(ThemeContext);
    const contacts = [
        { id: '1', name: 'Tory Nichols', status: 'Available', avatar: 'https://avatar.iran.liara.run/public/girl?username=Tory' },
        { id: '2', name: 'Kenny Payne', status: 'Busy', avatar: 'https://avatar.iran.liara.run/public/boy?username=Kenny' },
        { id: '3', name: 'Anthony LaRusso', status: 'Miyagi-Do 🥋', avatar: 'https://avatar.iran.liara.run/public/boy?username=Anthony' },
        { id: '4', name: 'Eli Moskowitz', status: 'I am busy all time', avatar: 'https://avatar.iran.liara.run/public/boy?username=Eli' },
        { id: '5', name: 'Johnny Lawrence', status: 'Cobra kai 🐍', avatar: 'https://avatar.iran.liara.run/public/boy?username=Johnny' },
        { id: '6', name: 'Robby Keene', status: '☠️Believe In Your Story☠️', avatar: 'https://avatar.iran.liara.run/public/boy?username=Robby' },
        { id: '7', name: 'Miguel Diaz', status: 'Samantha LaRusso my love', avatar: 'https://avatar.iran.liara.run/public/boy?username=Miguel' },
    ];

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
                    <Ionicons name="apps" size={20} color="#333" style={styles.dialpadIcon} />
                </View>
            </View>

            {/* Action Buttons */}
            <View style={styles.actionsContainer}>
                <ActionItem icon="people" label="New group" />
                <ActionItem icon="people-circle" label="New Channel" />
                <ActionItem icon="megaphone" label="New broadcast" />
            </View>

            {/* Section Header */}
            <View style={styles.sectionHeader}>
                <Text style={styles.sectionHeaderText}>Contacts on whatsapp</Text>
            </View>
        </View>
    );
const ActionItem = ({ icon, label }) => (
    <TouchableOpacity style={styles.actionItem}>
        <View style={styles.actionIconContainer}>
            <Ionicons name={icon} size={22} color="white" />
        </View>
        <Text style={[styles.actionLabel,{color:theme.text}]}>{label}</Text>
    </TouchableOpacity>
);

const ContactItem = ({ item }) => (
    <TouchableOpacity style={styles.contactItem}>
        <Image source={{ uri: item.avatar }} style={styles.avatar} />
        <View style={styles.contactInfo}>
            <Text style={[styles.contactName,{color:theme.text}]}>{item.name}</Text>
            <Text style={styles.contactStatus} numberOfLines={1}>{item.status}</Text>
        </View>
    </TouchableOpacity>
);
    return (
        <SafeAreaView  style={[styles.container,{ backgroundColor: theme.background}]}>
            <StatusBar barStyle="light-content" />

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Ionicons name="arrow-back" size={26} color="white" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Contact</Text>
            </View>

            <FlatList
                data={contacts}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => <ContactItem item={item} />}
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
        elevation: 4,
         paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 20,
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
    dialpadIcon: {
        marginLeft: 10,
    },
    actionsContainer: {
        paddingHorizontal: 15,
    },
    actionItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
    },
    actionIconContainer: {
        width: 45,
        height: 45,
        borderRadius: 22.5,
        backgroundColor: '#4491f2',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 15,
    },
    actionLabel: {
        fontSize: 16,
        fontWeight: '600',
        color: '#000',
    },
    sectionHeader: {
        paddingHorizontal: 15,
        paddingVertical: 10,
        marginTop: 5,
    },
    sectionHeaderText: {
        fontSize: 16,
        color: '#888',
    },
    contactItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 15,
        paddingVertical: 10,
        borderBottomWidth: 0.5,
        borderBottomColor: '#f0f0f0',
    },
    avatar: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: '#eee',
    },
    contactInfo: {
        flex: 1,
        marginLeft: 15,
    },
    contactName: {
        fontSize: 16,
        fontWeight: '700',
        color: '#222',
    },
    contactStatus: {
        fontSize: 12,
        color: '#888',
        marginTop: 2,
    },
});