import { useContext } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemeContext } from '../../../components/ThemeContext';
import { getUiColors } from '../../../utils/uiColors';
import AuthHeader from '../AuthHeader';

const TermsAndConditionsScreen = ({ renderSection }) => {
    const { t } = useTranslation();
    const { theme } = useContext(ThemeContext);
    const c = getUiColors(theme);
    const insets = useSafeAreaInsets();

    const sections = [
        {
            icon: 'document-text-outline',
            title: 'Usage Rules',
            text: 'By accessing Telebook you agree to these terms. Do not use Telebook if you do not agree to all of the terms stated on this page.',
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
            text: 'We may update these terms from time to time. Continued use of Telebook after changes means you accept the new terms.',
        },
    ];

    return (
        <View style={[styles.container, { backgroundColor: c.bg, paddingTop: insets.top }]}>
            <AuthHeader title="Terms & Conditions" onBack={() => renderSection(1)} c={c} />

            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                {/* Hero */}
                <View style={styles.hero}>
                    <View style={[styles.heroIcon, { backgroundColor: c.primarySoft }]}>
                        <Ionicons name="document-text" size={34} color={c.primary} />
                    </View>
                    <Text style={[styles.heroTitle, { color: c.text }]}>Please read carefully</Text>
                    <Text style={[styles.heroSub, { color: c.subText }]}>
                        These terms govern your use of Telebook
                    </Text>
                </View>

                {/* Sections */}
                {sections.map((sec) => (
                    <View key={sec.title} style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
                        <View style={[styles.iconWrap, { backgroundColor: c.primarySoft }]}>
                            <Ionicons name={sec.icon} size={20} color={c.primary} />
                        </View>
                        <View style={styles.cardBody}>
                            <Text style={[styles.cardTitle, { color: c.text }]}>{sec.title}</Text>
                            <Text style={[styles.cardText, { color: c.subText }]}>{sec.text}</Text>
                        </View>
                    </View>
                ))}
            </ScrollView>

            {/* Bottom Button */}
            <View style={[styles.footer, { backgroundColor: c.bg, borderTopColor: c.border, paddingBottom: insets.bottom + 16 }]}>
                <Text style={[styles.agreeText, { color: c.subText }]}>
                    By continuing you agree to the Terms & Privacy Policy
                </Text>
                <TouchableOpacity style={[styles.button, { backgroundColor: c.primary }]} onPress={() => renderSection(3)} activeOpacity={0.85}>
                    <Text style={styles.buttonText}>{t('Continue')}</Text>
                    <Ionicons name="arrow-forward" size={18} color="#fff" style={{ marginLeft: 8 }} />
                </TouchableOpacity>
            </View>
        </View>
    );
};

export default TermsAndConditionsScreen;

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    content: {
        paddingHorizontal: 18,
        paddingTop: 24,
        paddingBottom: 24,
    },
    hero: {
        alignItems: 'center',
        marginBottom: 24,
    },
    heroIcon: {
        width: 76,
        height: 76,
        borderRadius: 38,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 14,
    },
    heroTitle: {
        fontSize: 20,
        fontWeight: '700',
        marginBottom: 6,
    },
    heroSub: {
        fontSize: 14,
        textAlign: 'center',
        lineHeight: 20,
    },
    card: {
        flexDirection: 'row',
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        borderWidth: StyleSheet.hairlineWidth,
        gap: 14,
    },
    iconWrap: {
        width: 40,
        height: 40,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    cardBody: {
        flex: 1,
    },
    cardTitle: {
        fontSize: 15,
        fontWeight: '700',
        marginBottom: 4,
    },
    cardText: {
        fontSize: 13,
        lineHeight: 20,
    },
    footer: {
        paddingHorizontal: 20,
        paddingTop: 12,
        borderTopWidth: StyleSheet.hairlineWidth,
    },
    agreeText: {
        fontSize: 12,
        textAlign: 'center',
        marginBottom: 10,
    },
    button: {
        height: 54,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
    },
    buttonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '700',
    },
});
