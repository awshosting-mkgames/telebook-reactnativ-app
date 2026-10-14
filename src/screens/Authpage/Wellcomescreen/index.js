import { Ionicons } from '@expo/vector-icons';
import { useContext, useState } from 'react';
import {
    Image,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemeContext } from '../../../components/ThemeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useDispatch } from 'react-redux';
import i18n, { LANG_STORAGE_KEY } from '../../../i18n/i18n';
import { settotalappData } from '../../../redex/slices/totalappDataSlice';
import { getUiColors } from '../../../utils/uiColors';

const LANGUAGES = [
    { code: 'hi', flag: '🇮🇳', name: 'हिंदी', sub: 'Hindi' },
    { code: 'en', flag: '🇺🇸', name: 'English', sub: 'United States' },
];

const Wellcomescreen = ({ renderSection }) => {
    const [selectedLanguage, setSelectedLanguage] = useState('en');
    const { theme } = useContext(ThemeContext);
    const c = getUiColors(theme);
    const insets = useSafeAreaInsets();
    const dispatch = useDispatch();

    const handleContinue = async () => {
        await i18n.changeLanguage(selectedLanguage);
        await AsyncStorage.setItem(LANG_STORAGE_KEY, selectedLanguage);
        dispatch(settotalappData({ lang: selectedLanguage }));
        renderSection(2);
    };

    return (
        <View style={[styles.container, { backgroundColor: c.bg, paddingTop: insets.top }]}>
            <StatusBar translucent backgroundColor="transparent" barStyle={c.barStyle} />

            <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
                {/* Brand */}
                <View style={styles.heroSection}>
                    <Image source={require('../../../../assets/Logo.png')} style={styles.logo} />
                    <Text style={[styles.appName, { color: c.text }]}>Telebook</Text>
                    <Text style={[styles.tagline, { color: c.subText }]}>Connect. Chat. Share.</Text>
                </View>

                <Text style={[styles.sectionTitle, { color: c.subText }]}>
                    Select Language / भाषा चुनें
                </Text>

                <View style={styles.languageContainer}>
                    {LANGUAGES.map((lang) => {
                        const selected = selectedLanguage === lang.code;
                        return (
                            <TouchableOpacity
                                key={lang.code}
                                style={[
                                    styles.languageCard,
                                    {
                                        backgroundColor: selected ? c.primarySoft : c.card,
                                        borderColor: selected ? c.primary : c.border,
                                    },
                                ]}
                                onPress={() => setSelectedLanguage(lang.code)}
                                activeOpacity={0.7}
                            >
                                <View style={styles.languageContent}>
                                    <View style={[styles.flagCircle, { backgroundColor: c.bg }]}>
                                        <Text style={styles.flag}>{lang.flag}</Text>
                                    </View>
                                    <View>
                                        <Text style={[styles.languageName, { color: selected ? c.primary : c.text }]}>
                                            {lang.name}
                                        </Text>
                                        <Text style={[styles.languageSub, { color: c.subText }]}>{lang.sub}</Text>
                                    </View>
                                </View>
                                <View style={[
                                    styles.radio,
                                    { borderColor: selected ? c.primary : c.mutedText },
                                    selected && { backgroundColor: c.primary },
                                ]}>
                                    {selected && <Ionicons name="checkmark" size={16} color="#fff" />}
                                </View>
                            </TouchableOpacity>
                        );
                    })}
                </View>
            </ScrollView>

            <View style={[styles.buttonContainer, { paddingBottom: insets.bottom + 16 }]}>
                <TouchableOpacity
                    onPress={handleContinue}
                    style={[styles.continueButton, { backgroundColor: c.primary }]}
                    activeOpacity={0.85}
                >
                    <Text style={styles.continueText}>
                        {selectedLanguage === 'hi' ? 'जारी रखें' : 'Continue'}
                    </Text>
                    <Ionicons name="arrow-forward" size={20} color="#fff" style={{ marginLeft: 8 }} />
                </TouchableOpacity>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    scroll: {
        flexGrow: 1,
        justifyContent: 'center',
        paddingHorizontal: 20,
        paddingVertical: 24,
    },
    heroSection: {
        alignItems: 'center',
        marginBottom: 40,
    },
    logo: {
        width: 112,
        height: 112,
        borderRadius: 28,
        marginBottom: 18,
    },
    appName: {
        fontSize: 30,
        fontWeight: '800',
        letterSpacing: 0.3,
    },
    tagline: {
        fontSize: 15,
        marginTop: 6,
    },
    sectionTitle: {
        fontSize: 13,
        textAlign: 'center',
        marginBottom: 14,
        fontWeight: '600',
        letterSpacing: 0.3,
    },
    languageContainer: {
        gap: 12,
    },
    languageCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderRadius: 16,
        borderWidth: 1.5,
    },
    languageContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
    },
    flagCircle: {
        width: 48,
        height: 48,
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
    },
    flag: {
        fontSize: 26,
    },
    languageName: {
        fontSize: 16,
        fontWeight: '700',
    },
    languageSub: {
        fontSize: 12,
        marginTop: 2,
    },
    radio: {
        width: 26,
        height: 26,
        borderRadius: 13,
        borderWidth: 2,
        alignItems: 'center',
        justifyContent: 'center',
    },
    buttonContainer: {
        paddingHorizontal: 20,
        paddingTop: 12,
    },
    continueButton: {
        height: 54,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
    },
    continueText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '700',
    },
});

export default Wellcomescreen;
