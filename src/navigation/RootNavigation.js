import { createNavigationContainerRef, StackActions, CommonActions } from '@react-navigation/native';

export const navigationRef = createNavigationContainerRef();


export function navigate(name, params, options) {
    try {
        if (!navigationRef.isReady()) {
            console.warn('Navigation not ready yet');
            return;
        }

        if (!navigationRef.current) {
            console.warn('Navigation ref not initialized');
            return;
        }

        navigationRef.navigate(name, params, options);
    } catch (error) {
        console.error('Navigation error:', error);
    }
}

export function push(name, params) {
    if (navigationRef.isReady() && navigationRef.current?.dispatch) {
        navigationRef.current?.dispatch({
            ...StackActions.push(name, params),
        });
    }
}

// Go back to the previous screen
export function goBack() {
    if (navigationRef.isReady() && navigationRef.canGoBack()) {
        navigationRef.goBack();
    }
}