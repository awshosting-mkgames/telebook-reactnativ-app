// File: services/Logoutcall.js

import { clearPushToken, getStoredToken } from '../components/notification';
import { clearChatList } from '../redex/slices/chatListSlice';
import { clearContacts } from '../redex/slices/contactsSlice';
import { settotalappData } from '../redex/slices/totalappDataSlice';
import apiService from './apiService';
import { clearChatsDb } from './chatsDb';
import { clearContactsDb } from './contactsDb';
import { getDeviceId } from './deviceId';
import { clearMessagesDb } from './messagesDb';
import { saveData } from './staticStorage';

// Koi ek step (network / SQLite) atak jaye to bhi logout poora ho
const withTimeout = (promise, ms = 4000) =>
    Promise.race([Promise.resolve(promise).catch((e) => console.log('Logout step error:', e)), new Promise((r) => setTimeout(r, ms))]);

/**
 * Logout (API doc 6.1): pehle POST /auth/logout taaki is device par push band ho,
 * phir token aur local data saaf. `isLogin: false` hote hi root navigator khud
 * login screen dikha deta hai — alag se navigate nahi karna.
 */
export const logoutUser = async (_navigation, dispatch) => {
    try {
        const fcmToken = await withTimeout(getStoredToken(), 2000);
        const deviceId = await withTimeout(getDeviceId(), 2000);
        if (fcmToken || deviceId) {
            // Fail ho to bhi logout rukna nahi chahiye (offline etc.)
            await withTimeout(apiService({ method: 'POST', endpoint: 'auth/logout', data: { fcmToken, deviceId } }), 5000);
        }
        // Backend se hat gaya; Firebase ko bhi bata do taaki yeh device agli
        // baar naya token le (purana wapas na lauta de).
        await withTimeout(clearPushToken(), 2000);

        await withTimeout(Promise.all([
            saveData('userData', ''),
            saveData('token', ''),
            saveData('userId', ''),
            saveData('userType', ''),
            saveData('isLogin', false),
        ]));

        // Contacts / chats SQL me rehte hain — agla user pichhle user ka data na dekhe
        await withTimeout(clearContactsDb());
        await withTimeout(clearChatsDb());
        await withTimeout(clearMessagesDb());
    } finally {
        dispatch(clearContacts());
        dispatch(clearChatList());
        dispatch(settotalappData({
            user: null,
            isLogin: false,
            apiToken: '',
            userId: '',
            userType: '',
        }));
    }
};
