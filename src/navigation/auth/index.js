import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AuthPage } from '../../screens';
import MainNavigator from '../main'; // This is your TabNavigator

const Stack = createNativeStackNavigator();

const AuthNavigator = () => (
    <Stack.Navigator initialRouteName="AuthPage">
        <Stack.Screen name="AuthPage" component={AuthPage} options={{ headerShown: false }} />
        <Stack.Screen name="main" component={MainNavigator} options={{ headerShown: false }} />
    </Stack.Navigator>
    
);

export default AuthNavigator;
