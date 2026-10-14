import React, { useContext } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { Freechat, Channels, Call, Updates } from '../../screens';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemeContext } from '../../components/ThemeContext';

const Tab = createBottomTabNavigator();

// Tab bar ka apna usable area (icon + label). System nav bar / home indicator
// ki jagah iske alawa hai aur neeche safe-area inset se add hoti hai.
const TAB_BAR_HEIGHT = 60;
const TAB_BAR_PADDING_BOTTOM = 10;

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
    const insets = useSafeAreaInsets();

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
                        // Android edge-to-edge (gradle.properties: edgeToEdgeEnabled=true)
                        // mein system nav bar app ke upar draw hota hai. Fixed height
                        // dene par labels nav buttons ke peeche chale jate the, isliye
                        // bottom inset height aur padding dono mein jodna zaruri hai.
                        height: TAB_BAR_HEIGHT + insets.bottom,
                        paddingTop: 8,
                        paddingBottom: TAB_BAR_PADDING_BOTTOM + insets.bottom,
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