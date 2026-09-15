// File: services/Logoutcall.js

import { CommonActions } from '@react-navigation/native';
import { saveData } from './staticStorage';
import { settotalappData } from '../redex/slices/totalappDataSlice';

export const logoutUser = async (navigation, dispatch) => {
    try {
        await saveData('userData', '');
        await saveData('token', '');
        await saveData('userId', '');
        await saveData('userType', '');
        await saveData('isLogin', false);

        dispatch(settotalappData({
            user: '',
            isLogin: false,
            apiToken: '',
            userId: '',
        }));
        navigation.navigate('Auth')
    } catch (error) {
        console.error('Logout failed:', error);
    }
};
