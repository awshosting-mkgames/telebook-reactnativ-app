import { Ionicons } from '@expo/vector-icons';
import { useContext, useState } from 'react';
import {
    Platform,
    SafeAreaView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { ThemeContext } from '../../../components/ThemeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTranslation } from 'react-i18next';
import { useDispatch } from 'react-redux';
import i18n, { LANG_STORAGE_KEY } from '../../../i18n/i18n';
import { settotalappData } from '../../../redex/slices/totalappDataSlice';

const Wellcomescreen = ({ setPageSection, renderSection }) => {
    const { t } = useTranslation();
    const [selectedLanguage, setSelectedLanguage] = useState('en');
    const { theme } = useContext(ThemeContext);
    const dispatch = useDispatch();

    const handleContinue = async () => {
        await i18n.changeLanguage(selectedLanguage);
        await AsyncStorage.setItem(LANG_STORAGE_KEY, selectedLanguage);
        dispatch(settotalappData({ lang: selectedLanguage }));
        renderSection(2);
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
            <StatusBar backgroundColor={theme.statusbar} barStyle={theme?.statusbar} />

            {/* Hero illustration area */}
            <View style={styles.heroSection}>
                <View style={[styles.heroCircle, { backgroundColor: theme.inputBackground || '#EEF4FF' }]}>
                    <Text style={styles.heroEmoji}>💬</Text>
                </View>
                <Text style={[styles.appName, { color: theme.text }]}>TeleBook</Text>
                <Text style={[styles.tagline, { color: theme.subText || '#888' }]}>
                    Connect with anyone, anywhere
                </Text>
            </View>

            {/* Language label */}
            <Text style={[styles.sectionTitle, { color: theme.subText || '#888' }]}>
                Select Language / भाषा चुनें
            </Text>

            {/* Language Cards */}
            <View style={styles.languageContainer}>
                <TouchableOpacity
                    style={[
                        styles.languageCard,
                        { backgroundColor: theme.background, borderColor: selectedLanguage === 'hi' ? '#00A8FF' : theme.borderColor || '#E8E8E8' },
                        selectedLanguage === 'hi' && styles.selectedCard,
                    ]}
                    onPress={() => setSelectedLanguage('hi')}
                    activeOpacity={0.7}
                >
                    <View style={styles.languageContent}>
                        <View style={[styles.flagCircle, { backgroundColor: theme.inputBackground || '#F5F5F5' }]}>
                            <Text style={styles.flag}>🇮🇳</Text>
                        </View>
                        <View>
                            <Text style={[styles.languageName, { color: selectedLanguage === 'hi' ? '#00A8FF' : theme.text }]}>
                                हिंदी
                            </Text>
                            <Text style={[styles.languageSub, { color: theme.subText || '#999' }]}>Hindi</Text>
                        </View>
                    </View>
                    {selectedLanguage === 'hi' && (
                        <View style={styles.checkCircle}>
                            <Ionicons name="checkmark" size={16} color="#fff" />
                        </View>
                    )}
                </TouchableOpacity>

                <TouchableOpacity
                    style={[
                        styles.languageCard,
                        { backgroundColor: theme.background, borderColor: selectedLanguage === 'en' ? '#00A8FF' : theme.borderColor || '#E8E8E8' },
                        selectedLanguage === 'en' && styles.selectedCard,
                    ]}
                    onPress={() => setSelectedLanguage('en')}
                    activeOpacity={0.7}
                >
                    <View style={styles.languageContent}>
                        <View style={[styles.flagCircle, { backgroundColor: theme.inputBackground || '#F5F5F5' }]}>
                            <Text style={styles.flag}>🇺🇸</Text>
                        </View>
                        <View>
                            <Text style={[styles.languageName, { color: selectedLanguage === 'en' ? '#00A8FF' : theme.text }]}>
                                English
                            </Text>
                            <Text style={[styles.languageSub, { color: theme.subText || '#999' }]}>United States</Text>
                        </View>
                    </View>
                    {selectedLanguage === 'en' && (
                        <View style={styles.checkCircle}>
                            <Ionicons name="checkmark" size={16} color="#fff" />
                        </View>
                    )}
                </TouchableOpacity>
            </View>

            {/* Continue Button */}
            <View style={styles.buttonContainer}>
                <TouchableOpacity
                    onPress={handleContinue}
                    style={styles.continueButton}
                    activeOpacity={0.8}
                >
                    <Text style={styles.continueText}>
                        {selectedLanguage === 'hi' ? 'जारी रखें' : 'Continue'}
                    </Text>
                    <Ionicons name="arrow-forward" size={20} color="#fff" style={{ marginLeft: 8 }} />
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        paddingHorizontal: 20,
        paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
    },
    heroSection: {
        alignItems: 'center',
        marginTop: 60,
        marginBottom: 32,
    },
    heroCircle: {
        width: 120,
        height: 120,
        borderRadius: 60,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    heroEmoji: {
        fontSize: 52,
    },
    appName: {
        fontSize: 28,
        fontWeight: '700',
        letterSpacing: 0.5,
    },
    tagline: {
        fontSize: 14,
        marginTop: 6,
    },
    sectionTitle: {
        fontSize: 13,
        textAlign: 'center',
        marginBottom: 16,
        fontWeight: '500',
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
    selectedCard: {
        backgroundColor: '#F0F8FF',
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
        fontWeight: '600',
    },
    languageSub: {
        fontSize: 12,
        marginTop: 2,
    },
    checkCircle: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: '#00A8FF',
        alignItems: 'center',
        justifyContent: 'center',
    },
    buttonContainer: {
        flex: 1,
        justifyContent: 'flex-end',
        paddingBottom: 44,
        marginTop: 20,
    },
    continueButton: {
        backgroundColor: '#00A8FF',
        paddingVertical: 16,
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
