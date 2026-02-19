import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import BottomTabNavigator from '../bottomtab';
import AuthNavigator from '../auth'
import { Call, Chat, Channels, Contact, Freechat, Inviteafriends, Settings, AuthPage, Community,Profile, Updates,Group } from '../../screens';

const Stack = createNativeStackNavigator();



const MainNavigator = ({ navigation }) => {
    return (
        <Stack.Navigator initialRouteName="tab">
            <Stack.Screen name="tab" options={{ headerShown: false, statusBarTranslucent: true }}  component={BottomTabNavigator} />
            <Stack.Screen name="Call" options={{ headerShown: false, statusBarTranslucent: true }}  component={Call} />
            <Stack.Screen name="Chat" options={{ headerShown: false, statusBarTranslucent: true }}  component={Chat} />
            <Stack.Screen name="Channels" options={{ headerShown: false, statusBarTranslucent: true }}  component={Channels} />
            <Stack.Screen name="Contact" options={{ headerShown: false, statusBarTranslucent: true }}  component={Contact} />
            <Stack.Screen name="Freechat" options={{ headerShown: false, statusBarTranslucent: true }}  component={Freechat} />
            <Stack.Screen name="Inviteafriends" options={{ headerShown: false, statusBarTranslucent: true }}  component={Inviteafriends} />
            <Stack.Screen name="Settings" options={{ headerShown: false, statusBarTranslucent: true }}  component={Settings} />
            <Stack.Screen name="Authsec" options={{ headerShown: false, statusBarTranslucent: true }}  component={AuthNavigator} />
            <Stack.Screen name="Profile" options={{ headerShown: false, statusBarTranslucent: true }}  component={Profile} />
            <Stack.Screen name="Community" options={{ headerShown: false, statusBarTranslucent: true }}  component={Community} />
            <Stack.Screen name="Updates" options={{ headerShown: false, statusBarTranslucent: true }}  component={Updates} />
            <Stack.Screen name="Group" options={{ headerShown: false, statusBarTranslucent: true }}  component={Group} />
        </Stack.Navigator>
    );
};

export default MainNavigator;
