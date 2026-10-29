import React, { useContext, useEffect, useMemo } from 'react';
import { navigationRef, flushPendingNavigation } from './RootNavigation';
import { NavigationContainer, DefaultTheme, DarkTheme as NavDarkTheme } from '@react-navigation/native';
import { ThemeContext } from '../components/ThemeContext';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AuthNavigator from './auth';
import MainNavigator from './main';
import { useSelector } from 'react-redux';
import { linking, flushPendingDeepLink } from './deepLinks';

const Stack = createNativeStackNavigator();

const AppNavigator = () => {
    const maniAllData = useSelector((state) => state.totalappData);
    const IsloginSection = maniAllData?.isLogin;
    const { theme } = useContext(ThemeContext);
    const isDark = theme?.mode === 'dark';
    const bg = theme?.background || (isDark ? '#000000' : '#ffffff');

    // Point 3: page transition ke beech safed flash isliye aata tha ki navigator/scene ka
    // background hard-coded white tha. Ab navigation theme + scene dono current theme se.
    const navTheme = useMemo(() => {
        const base = isDark ? NavDarkTheme : DefaultTheme;
        return { ...base, colors: { ...base.colors, background: bg, card: bg } };
    }, [isDark, bg]);

    // Login se pehle aaya deep link ab kholo
    useEffect(() => {
        if (IsloginSection) flushPendingDeepLink();
    }, [IsloginSection]);

    return (
        <NavigationContainer
            ref={navigationRef}
            linking={linking}
            theme={navTheme}
            onReady={flushPendingNavigation}
        >
            <Stack.Navigator screenOptions={{ headerShown: false, animation: 'none', contentStyle: { backgroundColor: bg } }}>
                {IsloginSection ? (
                    <Stack.Screen name="main" component={MainNavigator} />
                ) : (
                    <Stack.Screen name="auth" component={AuthNavigator} />
                )}
            </Stack.Navigator>
        </NavigationContainer>
    );
};

export default AppNavigator;
