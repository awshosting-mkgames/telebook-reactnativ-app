import { Alert } from 'react-native';

// Server limit poori hone par 403 { code: 'PLAN_LIMIT', message, limitKey, limit, used, planCode } deta hai.
// Yahan ek jagah se "Upgrade Plan" alert dikhta hai (Plans screen par le jata hai).
export const isPlanLimit = (res) => res?.error?.code === 'PLAN_LIMIT' || res?.error?.code === 'DEVICE_LIMIT';

/**
 * res = apiService ka result. PLAN_LIMIT ho to alert dikha kar true lautata hai (caller aage kuch na kare).
 * extraButtons: [{ text, onPress }] — jaise 'Add Coins'.
 */
export const handlePlanLimit = (res, navigation, extraButtons = []) => {
    if (!isPlanLimit(res)) return false;
    Alert.alert(
        'Plan Limit Reached',
        ['Plan Limit Reached – Upgrade your plan to continue.', res.error?.message].filter(Boolean).join('\n'),
        [
            ...extraButtons,
            { text: 'Upgrade Plan', onPress: () => navigation?.navigate?.('Plans') },
            { text: 'Cancel', style: 'cancel' },
        ]
    );
    return true;
};
