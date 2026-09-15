import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Provider, useSelector } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import Toast from 'react-native-toast-message';

import StatusBarComponent from './components/StatusBarcom';
import { ThemeProvider } from './components/ThemeContext';
import AppNavigator from './navigation';
import { persistor, store } from './redex/store';
import socketService from './services/socketService';
import {
    generateAndSaveFCMToken,
    setupAndroidChannel,
    setupBackgroundHandler,
    setupForegroundHandler,
    setupNotificationClickHandlers,
    setupTokenRefreshListener,
} from './components/notification';

setupBackgroundHandler();

const SocketManager = () => {
    const maniAllData = useSelector((state) => state.totalappData);
    const token  = maniAllData?.apiToken ?? null;
    const userId = maniAllData?.userId   ?? null;

    useEffect(() => {
        if (token && userId) {
            socketService.connect(token, userId);
        } else {
            socketService.disconnect();
        }
        return () => socketService.disconnect();
    }, [token, userId]);

    return null;
};

export default function App() {
    useEffect(() => {
        let cleanupForeground = () => {};
        let cleanupClicks     = () => {};
        let cleanupRefresh    = () => {};

        async function init() {
            await setupAndroidChannel();
            await generateAndSaveFCMToken();
            cleanupRefresh    = setupTokenRefreshListener(() => {});
            cleanupForeground = setupForegroundHandler();
            cleanupClicks     = setupNotificationClickHandlers();
        }

        const timer = setTimeout(init, 300);

        return () => {
            clearTimeout(timer);
            cleanupForeground();
            cleanupClicks();
            cleanupRefresh();
        };
    }, []);

    return (
        <ThemeProvider>
            <Provider store={store}>
                <PersistGate loading={null} persistor={persistor}>
                    <SafeAreaProvider>
                        <StatusBarComponent />
                        <SocketManager />
                        <AppNavigator />
                        <Toast />
                    </SafeAreaProvider>
                </PersistGate>
            </Provider>
        </ThemeProvider>
    );
}
