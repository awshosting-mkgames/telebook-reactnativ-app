import { createNavigationContainerRef } from '@react-navigation/native';

export const navigationRef = createNavigationContainerRef();

let pendingNavigation = null;

export function navigate(screen, params) {
    if (navigationRef.isReady()) {
        navigationRef.navigate(screen, params);
        pendingNavigation = null;
    } else {
        pendingNavigation = { screen, params };
        console.log('⏳ Navigation pending:', screen, params);
    }
}

export function flushPendingNavigation() {
    if (pendingNavigation && navigationRef.isReady()) {
        const { screen, params } = pendingNavigation;
        pendingNavigation = null;
        console.log('🚀 Flushing pending navigation:', screen, params);
        navigationRef.navigate(screen, params);
    }
}
