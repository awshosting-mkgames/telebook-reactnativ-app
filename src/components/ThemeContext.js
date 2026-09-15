import React, { createContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LightTheme, DarkTheme } from '../utils/theme';

export const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
    const [theme, setTheme] = useState(LightTheme);
    const [loading, setLoading] = useState(true);

    // Load theme from async
    useEffect(() => {
        loadTheme();
    }, []);

    const loadTheme = async () => {
        try {
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

    const toggleTheme = async () => {
        console.log("sadasdasdasd")
        const newTheme =
            theme.mode === 'light' ? DarkTheme : LightTheme;

        setTheme(newTheme);
        await AsyncStorage.setItem('APP_THEME', newTheme.mode);
    };

    if (loading) return null;

    return (
        <ThemeContext.Provider value={{ theme, toggleTheme }}>
            {children}
        </ThemeContext.Provider>
    );
};
