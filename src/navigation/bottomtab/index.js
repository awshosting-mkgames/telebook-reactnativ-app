import React, { useContext } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { Freechat, Channels, Call, Updates } from '../../screens';
import { ThemeContext } from '../../components/ThemeContext';

const Tab = createBottomTabNavigator();

export default function BottomTabNavigator() {

    const { theme } = useContext(ThemeContext); // ✅ theme yaha use karo

    return (
        <Tab.Navigator
            screenOptions={({ route }) => ({
                headerShown: false,

                tabBarIcon: ({ focused, color, size }) => {
                    let iconName;

                    if (route.name === 'Chats') {
                        iconName = focused ? 'chatbox-ellipses-sharp' : 'chatbox-ellipses-outline';
                    } else if (route.name === 'Updates') {
                        iconName = focused ? 'radio-button-on' : 'radio-button-on-outline';
                    } else if (route.name === 'Calls') {
                        iconName = focused ? 'call' : 'call-outline';
                    } else if (route.name === 'Channels') {
                        iconName = focused ? 'people' : 'people-outline';
                    }

                    return (
                        <Ionicons
                            name={iconName}
                            size={size}
                            color={color}
                        />
                    );
                },

                // ✅ Theme Based Colors
                tabBarActiveTintColor: theme.main,
                tabBarInactiveTintColor: theme.text === '#FFFFFF' ? '#888' : '#999',

                tabBarStyle: {
                    backgroundColor: theme.background, // ✅ Yaha add kiya
                    paddingBottom: 5,
                    paddingTop: 5,
                    height: 60,
                    borderTopWidth: 1,
                    borderTopColor: theme.text === '#FFFFFF' ? '#222' : '#E0E0E0',
                },

                tabBarLabelStyle: {
                    fontSize: 12,
                    color: theme.text,
                },
            })}
        >
            <Tab.Screen name="Chats" component={Freechat} />
            <Tab.Screen name="Updates" component={Updates} />
            <Tab.Screen name="Channels" component={Channels} />
            <Tab.Screen name="Calls" component={Call} />
        </Tab.Navigator>
    );
}
