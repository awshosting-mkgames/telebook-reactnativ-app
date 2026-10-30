import React, { createContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SystemUI from 'expo-system-ui';
import { LightTheme, DarkTheme } from '../utils/theme';
import { FONT_SIZES, patchTextFontScale, setGlobalFontScale } from '../utils/fontScale';

patchTextFontScale();

export const ThemeContext = createContext();

// Backend `user.themeColor` (hex). Galat / khali ho to default theme hi chalega.
const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
export const isValidThemeColor = (c) => typeof c === 'string' && HEX.test(c.trim());

export const ThemeProvider = ({ children }) => {
    const [theme, setTheme] = useState(LightTheme);
    const [loading, setLoading] = useState(true);
    const [brandColor, setBrandColor] = useState(null);
    const [fontSize, setFontSizeState] = useState('medium'); // small | medium | large

    // Load theme from async
    useEffect(() => {
        loadTheme();
    }, []);

    const loadTheme = async () => {
        try {
            const savedFont = await AsyncStorage.getItem('APP_FONT_SIZE');
            if (savedFont && FONT_SIZES[savedFont]) {
                setGlobalFontScale(savedFont);
                setFontSizeState(savedFont);
            }
            const savedTheme = await AsyncStorage.getItem('APP_THEME');
            if (savedTheme === 'dark') {
                setTheme(DarkTheme);
            } else {
                setTheme(LightTheme);
            }
        } catch (e) {
            setTheme(LightTheme);
        } finally {
            setLoading(false);
        }
    };

    const setFontSize = async (key) => {
        if (!FONT_SIZES[key]) return;
        setGlobalFontScale(key);
        setFontSizeState(key);
        try { await AsyncStorage.setItem('APP_FONT_SIZE', key); } catch (e) { /* ignore */ }
    };

    const toggleTheme = async () => {
        console.log("sadasdasdasd")
        const newTheme =
            theme.mode === 'light' ? DarkTheme : LightTheme;

        setTheme(newTheme);
        await AsyncStorage.setItem('APP_THEME', newTheme.mode);
    };

    // Brand color sirf main / maincolor aur header par; dark theme ka header kala hi rehta hai.
    const themed = useMemo(() => {
        if (!brandColor) return theme;
        const next = { ...theme, main: brandColor, maincolor: brandColor };
        if (theme.mode === 'light') next.header = brandColor;
        return next;
    }, [theme, brandColor]);

    // Point 3: native window ka background bhi theme ke saath badlo, warna screen slide ke
    // dauran right side se safed jhalak (system day/night theme ka window colour) dikhti hai.
    useEffect(() => {
        SystemUI.setBackgroundColorAsync(themed.background).catch(() => {});
    }, [themed.background]);

    if (loading) return null;

    return (
        <ThemeContext.Provider value={{ theme: themed, toggleTheme, setBrandColor, fontSize, setFontSize, fontScale: FONT_SIZES[fontSize] }}>
            {children}
        </ThemeContext.Provider>
    );
};
