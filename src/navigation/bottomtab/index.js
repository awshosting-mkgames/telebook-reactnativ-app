import React, { useContext } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { Freechat, Channels, Call, Updates } from '../../screens';
import { ThemeContext } from '../../components/ThemeContext';

const Tab = createBottomTabNavigator();

const TAB_CONFIG = [
    {
        name: 'Chats',
        iconFocused: 'chatbubble-ellipses',
        iconBlur: 'chatbubble-ellipses-outline',
    },
    {
        name: 'Updates',
        iconFocused: 'radio-button-on',
        iconBlur: 'radio-button-on-outline',
    },
    {
        name: 'Channels',
        iconFocused: 'people',
        iconBlur: 'people-outline',
    },
    {
        name: 'Calls',
        iconFocused: 'call',
        iconBlur: 'call-outline',
    },
];

const SCREENS = { Chats: Freechat, Updates, Channels, Calls: Call };

export default function BottomTabNavigator() {
    const { theme } = useContext(ThemeContext);

    const isDark = theme.mode === 'light';
    const activeColor = theme.main || '#1199ff';
    const inactiveColor = isDark ? '#0f0f0f' : '#dedddd';
    const borderColor = isDark ? '#222' : '#ececec';

    return (
        <Tab.Navigator
            screenOptions={({ route }) => {
                const cfg = TAB_CONFIG.find(t => t.name === route.name);

                return {
                    headerShown: false,

                    tabBarIcon: ({ focused, size }) => {
                        const iconName = focused ? cfg.iconFocused : cfg.iconBlur;
                        const color = focused ? activeColor : inactiveColor;

                        return (
                            <View style={styles.iconWrap}>
                                {focused && (
                                    <View style={[styles.activePill, { backgroundColor: activeColor + '18' }]} />
                                )}
                                <Ionicons name={iconName} size={size} color={color} />
                            </View>
                        );
                    },

                    tabBarLabel: ({ focused }) => (
                        <Text style={[
                            styles.label,
                            { color: focused ? activeColor : inactiveColor },
                            focused && styles.labelActive,
                        ]}>
                            {route.name}
                        </Text>
                    ),

                    tabBarStyle: {
                        backgroundColor: theme.background,
                        height: Platform.OS === 'ios' ? 84 : 68,
                        paddingTop: 8,
                        paddingBottom: Platform.OS === 'ios' ? 24 : 10,
                        borderTopWidth: 0.5,
                        borderTopColor: borderColor,
                        elevation: 8,
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: -2 },
                        shadowOpacity: isDark ? 0.3 : 0.06,
                        shadowRadius: 8,
                    },

                    tabBarActiveTintColor: activeColor,
                    tabBarInactiveTintColor: inactiveColor,
                };
            }}
        >
            {TAB_CONFIG.map(({ name }) => (
                <Tab.Screen key={name} name={name} component={SCREENS[name]} />
            ))}
        </Tab.Navigator>
    );
}

const styles = StyleSheet.create({
    iconWrap: {
        alignItems: 'center',
        justifyContent: 'center',
        width: 52,
        height: 32,
        position: 'relative',
    },
    activePill: {
        position: 'absolute',
        width: 52,
        height: 32,
        borderRadius: 16,
    },
    label: {
        fontSize: 11,
        marginTop: 2,
        fontWeight: '400',
    },
    labelActive: {
        fontWeight: '600',
    },
});