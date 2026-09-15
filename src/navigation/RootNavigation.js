import { createNavigationContainerRef, StackActions, CommonActions } from '@react-navigation/native';

export const navigationRef = createNavigationContainerRef();

let pendingNavigation = null;

export function navigate(name, params, options) {
    if (navigationRef.isReady()) {
        navigationRef.navigate(name, params, options);
        pendingNavigation = null;
    } else {
        pendingNavigation = { name, params, options };
    }
}

export function flushPendingNavigation() {
    if (pendingNavigation && navigationRef.isReady()) {
        const { name, params, options } = pendingNavigation;
        pendingNavigation = null;
        navigationRef.navigate(name, params, options);
    }
}

export function push(name, params) {
    if (navigationRef.isReady() && navigationRef.current?.dispatch) {
        navigationRef.current.dispatch(StackActions.push(name, params));
    }
}

export function goBack() {
    if (navigationRef.isReady() && navigationRef.canGoBack()) {
        navigationRef.goBack();
    }
}
