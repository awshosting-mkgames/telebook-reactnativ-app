import React from 'react';
import { navigationRef, flushPendingNavigation } from './RootNavigation';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AuthNavigator from './auth';
import MainNavigator from './main';
import { useSelector } from 'react-redux';

const Stack = createNativeStackNavigator();

const AppNavigator = () => {
    const maniAllData = useSelector((state) => state.totalappData);
    const IsloginSection = maniAllData?.isLogin;

    return (
        <NavigationContainer
            ref={navigationRef}
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
