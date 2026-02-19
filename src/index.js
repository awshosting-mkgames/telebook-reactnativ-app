
import React, { useRef, useState, useEffect } from 'react';
import AppNavigator from './navigation';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import StatusBarComponent from './components/StatusBarcom';
import { ThemeProvider } from './components/ThemeContext';


export default function App() {
    

    return (
        <ThemeProvider>
            <SafeAreaProvider>
                <StatusBarComponent />
                <AppNavigator />
            </SafeAreaProvider>
        </ThemeProvider>
       
    );
}