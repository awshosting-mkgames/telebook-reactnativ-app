import React, { useEffect } from 'react';
import { navigationRef, flushPendingNavigation } from './RootNavigation';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AuthNavigator from './auth';
import MainNavigator from './main';
import { useSelector } from 'react-redux';
import { linking, flushPendingDeepLink } from './deepLinks';

const Stack = createNativeStackNavigator();

const AppNavigator = () => {
    const maniAllData = useSelector((state) => state.totalappData);
    const IsloginSection = maniAllData?.isLogin;

    // Login se pehle aaya deep link ab kholo
    useEffect(() => {
        if (IsloginSection) flushPendingDeepLink();
    }, [IsloginSection]);

    return (
        <NavigationContainer
            ref={navigationRef}
            linking={linking}
            onReady={flushPendingNavigation}
        >
            <Stack.Navigator screenOptions={{ headerShown: false, animation: 'none', contentStyle: { backgroundColor: '#ffffff' } }}>
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
