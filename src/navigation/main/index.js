import React, { useContext } from 'react';
import { ThemeContext } from '../../components/ThemeContext';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import BottomTabNavigator from '../bottomtab';
import AuthNavigator from '../auth'
import { Deleteaccount, Aboutus, TermsConditionsScreen, PrivacyPolicyScreen, Call, Chat, Channels, Contact, Freechat, Mychannelscreen, Channeldetailscreen, Inviteafriends, CreateBroadcast, ChatUserDetailScreen, MyBroadcastList, BroadcastDetails, BroadcastStats, Settings, AvatarScreen, AuthPage, FindContact, CreateGroup, Community, Profile, Updates, Group, InCallScreen, Plans, Wallet, PlanHistory, LinkedDevices, AutoReply } from '../../screens';

const Stack = createNativeStackNavigator();



const MainNavigator = ({ navigation }) => {
    const { theme } = useContext(ThemeContext);

    // Point 3: slide transition me peeche/side se safed jhalak na aaye isliye scene background theme ka
    return (
        <Stack.Navigator
            initialRouteName="tab"
            screenOptions={{ contentStyle: { backgroundColor: theme.background } }}
        >
            <Stack.Screen name="tab" options={{ headerShown: false, statusBarTranslucent: true }} component={BottomTabNavigator} />
            <Stack.Screen name="Call" options={{ headerShown: false, statusBarTranslucent: true }} component={Call} />
            <Stack.Screen name="Chat" options={{ headerShown: false, statusBarTranslucent: true }} component={Chat} />
            <Stack.Screen name="Channels" options={{ headerShown: false, statusBarTranslucent: true }} component={Channels} />
            <Stack.Screen name="Contact" options={{ headerShown: false, statusBarTranslucent: true }} component={Contact} />
            <Stack.Screen name="Freechat" options={{ headerShown: false, statusBarTranslucent: true }} component={Freechat} />
            <Stack.Screen name="Inviteafriends" options={{ headerShown: false, statusBarTranslucent: true }} component={Inviteafriends} />
            <Stack.Screen name="Settings" options={{ headerShown: false, statusBarTranslucent: true }} component={Settings} />
            <Stack.Screen name="Authsec" options={{ headerShown: false, statusBarTranslucent: true }} component={AuthNavigator} />
            <Stack.Screen name="Profile" options={{ headerShown: false, statusBarTranslucent: true }} component={Profile} />
            <Stack.Screen name="Community" options={{ headerShown: false, statusBarTranslucent: true }} component={Community} />
            <Stack.Screen name="Updates" options={{ headerShown: false, statusBarTranslucent: true }} component={Updates} />
            <Stack.Screen name="Group" options={{ headerShown: false, statusBarTranslucent: true }} component={Group} />
            <Stack.Screen name="FindContact" options={{ headerShown: false, statusBarTranslucent: true }} component={FindContact} />
            <Stack.Screen name="CreateGroup" options={{ headerShown: false, statusBarTranslucent: true }} component={CreateGroup} />
            <Stack.Screen name="Avatar" options={{ headerShown: false, statusBarTranslucent: true }} component={AvatarScreen} />
            <Stack.Screen name="ChatUserDetailScreen" options={{ headerShown: false, statusBarTranslucent: true }} component={ChatUserDetailScreen} />
            <Stack.Screen name="Mychannelscreen" options={{ headerShown: false, statusBarTranslucent: true }} component={Mychannelscreen} />
            <Stack.Screen name="Channeldetailscreen" options={{ headerShown: false, statusBarTranslucent: true }} component={Channeldetailscreen} />
            <Stack.Screen name="MyBroadcastList" options={{ headerShown: false, statusBarTranslucent: true }} component={MyBroadcastList} />
            <Stack.Screen name="BroadcastDetails" options={{ headerShown: false, statusBarTranslucent: true }} component={BroadcastDetails} />
            <Stack.Screen name="BroadcastStats" options={{ headerShown: false, statusBarTranslucent: true }} component={BroadcastStats} />
            <Stack.Screen name="CreateBroadcast" options={{ headerShown: false, statusBarTranslucent: true }} component={CreateBroadcast} />

            <Stack.Screen name="TermsConditionsScreen" options={{ headerShown: false, statusBarTranslucent: true }} component={TermsConditionsScreen} />
            <Stack.Screen name="PrivacyPolicyScreen" options={{ headerShown: false, statusBarTranslucent: true }} component={PrivacyPolicyScreen} />

            <Stack.Screen name="Aboutus" options={{ headerShown: false, statusBarTranslucent: true }} component={Aboutus} />
            <Stack.Screen name="Deleteaccount" options={{ headerShown: false, statusBarTranslucent: true }} component={Deleteaccount} />

            <Stack.Screen name="InCall" options={{ headerShown: false, statusBarTranslucent: true }} component={InCallScreen} />
            <Stack.Screen name="Plans" options={{ headerShown: false, statusBarTranslucent: true }} component={Plans} />
            <Stack.Screen name="Wallet" options={{ headerShown: false, statusBarTranslucent: true }} component={Wallet} />
            <Stack.Screen name="PlanHistory" options={{ headerShown: false, statusBarTranslucent: true }} component={PlanHistory} />
            <Stack.Screen name="LinkedDevices" options={{ headerShown: false, statusBarTranslucent: true }} component={LinkedDevices} />
            <Stack.Screen name="AutoReply" options={{ headerShown: false, statusBarTranslucent: true }} component={AutoReply} />
        </Stack.Navigator>
    );
};

export default MainNavigator;
