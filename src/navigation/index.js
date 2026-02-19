import React, { useRef, useState, useEffect } from 'react';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import StatusBarComponent from '../components/StatusBarcom';    
import { navigationRef } from './RootNavigation'; 
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import AuthNavigator from './auth';
import MainNavigator from './main';

const Stack = createNativeStackNavigator();

const AppNavigator = () => {
    const [loading, setLoading] = useState(true);
    const [showOnboarding, setShowOnboarding] = useState(false);

    useEffect(() => {
        console.log("AppNavigator Loaded");
        checkOnboarding();
    }, []);

    const checkOnboarding = async () => {
        const done = await AsyncStorage.getItem('IsLogin');
        setShowOnboarding(!done);
        setLoading(false);
    };

    if (loading) return null;

    return (
        <NavigationContainer  ref={navigationRef}>
            <Stack.Navigator screenOptions={{ headerShown: false ,animation: 'none', contentStyle: { backgroundColor: '#ffffff' },}}>
                <Stack.Screen name="auth" component={AuthNavigator} />
                <Stack.Screen name="main" component={MainNavigator} />
            </Stack.Navigator>
        </NavigationContainer>
    );
}

export default AppNavigator;