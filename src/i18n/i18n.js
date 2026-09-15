import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';

import en from './locales/en.json';
import hi from './locales/hi.json';

export const LANG_STORAGE_KEY = '@app_language';

const languageDetector = {
    type: 'languageDetector',
    async: true,
    detect: async (callback) => {
        try {
            const savedLang = await AsyncStorage.getItem(LANG_STORAGE_KEY);
            callback(savedLang || 'en');
        } catch {
            callback('en');
        }
    },
    init: () => {},
    cacheUserLanguage: async (lang) => {
        try {
            await AsyncStorage.setItem(LANG_STORAGE_KEY, lang);
        } catch {}
    },
};

i18n
    .use(languageDetector)
    .use(initReactI18next)
    .init({
        resources: {
            en: { translation: en },
            hi: { translation: hi },
        },
        fallbackLng: 'en',
        compatibilityJSON: 'v3',
        interpolation: { escapeValue: false },
    });

export default i18n;
