import React, { useState, useContext } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    SafeAreaView,
    StatusBar,
    Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { ThemeContext } from '../../../components/ThemeContext';

const TermsAndConditionsScreen = ({ navigation, renderSection }) => {
    const { t } = useTranslation();
    const { theme } = useContext(ThemeContext);

    const sections = [
        {
            icon: 'document-text-outline',
            title: 'Usage Rules',
            text: 'By accessing TeleBook you agree to these terms. Do not use TeleBook if you do not agree to all of the terms stated on this page.',
        },
        {
            icon: 'shield-checkmark-outline',
            title: 'Privacy & Data',
            text: 'We value your privacy. Your personal data is stored securely and never shared with third parties without your consent.',
        },
        {
            icon: 'people-outline',
            title: 'User Conduct',
            text: 'You agree not to misuse the platform, send spam, or engage in any activity that may harm other users or the service.',
        },
        {
            icon: 'refresh-outline',
            title: 'Updates to Terms',
            text: 'We may update these terms from time to time. Continued use of TeleBook after changes means you accept the new terms.',
        },
    ];

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
            <StatusBar backgroundColor="#1199ff" barStyle="light-content" />

            {/* Header */}
            <View style={[styles.header, { borderBottomColor: theme.borderColor || '#eee' }]}>
                <TouchableOpacity style={styles.backBtn} onPress={() => renderSection(1)}>
                    <Ionicons name="arrow-back" size={24} color={theme.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: theme.text }]}>Terms &amp; Conditions</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

                {/* Hero */}
                <View style={[styles.heroBox, { backgroundColor: theme.inputBackground || '#EEF4FF' }]}>
                    <Text style={styles.heroEmoji}>📋</Text>
                    <Text style={[styles.heroTitle, { color: theme.text }]}>Please read carefully</Text>
                    <Text style={[styles.heroSub, { color: theme.subText || '#888' }]}>
                        These terms govern your use of TeleBook
                    </Text>
                </View>

                {/* Sections */}
                {sections.map((sec, idx) => (
                    <View key={idx} style={[styles.card, { backgroundColor: theme.inputBackground || '#F8F8F8', borderColor: theme.borderColor || '#eee' }]}>
                        <View style={styles.cardHeader}>
                            <View style={styles.iconWrap}>
                                <Ionicons name={sec.icon} size={20} color="#1294F2" />
                            </View>
                            <Text style={[styles.cardTitle, { color: theme.text }]}>{sec.title}</Text>
                        </View>
                        <Text style={[styles.cardText, { color: theme.subText || '#666' }]}>{sec.text}</Text>
                    </View>
                ))}

                <View style={{ height: 100 }} />
            </ScrollView>

            {/* Bottom Button */}
            <View style={[styles.footer, { backgroundColor: theme.background, borderTopColor: theme.borderColor || '#eee' }]}>
                <TouchableOpacity style={styles.button} onPress={() => renderSection(3)} activeOpacity={0.8}>
                    <Text style={styles.buttonText}>{t('Continue')}</Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
};

export default TermsAndConditionsScreen;

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
        paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 0.5,
    },
    backBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitle: {
        fontSize: 17,
        fontWeight: '600',
    },
    content: {
        paddingHorizontal: 18,
        paddingTop: 20,
    },
    heroBox: {
        borderRadius: 20,
        padding: 24,
        alignItems: 'center',
        marginBottom: 20,
    },
    heroEmoji: {
        fontSize: 44,
        marginBottom: 10,
    },
    heroTitle: {
        fontSize: 18,
        fontWeight: '700',
        marginBottom: 6,
    },
    heroSub: {
        fontSize: 13,
        textAlign: 'center',
        lineHeight: 20,
    },
    card: {
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        borderWidth: 0.5,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
        gap: 10,
    },
    iconWrap: {
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: '#EEF4FF',
        alignItems: 'center',
        justifyContent: 'center',
    },
    cardTitle: {
        fontSize: 15,
        fontWeight: '600',
    },
    cardText: {
        fontSize: 13,
        lineHeight: 20,
        marginLeft: 46,
    },
    footer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        paddingHorizontal: 20,
        paddingBottom: Platform.OS === 'ios' ? 34 : 20,
        paddingTop: 12,
        borderTopWidth: 0.5,
    },
    button: {
        height: 52,
        backgroundColor: '#1294F2',
        borderRadius: 26,
        alignItems: 'center',
        justifyContent: 'center',
    },
    buttonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
});
