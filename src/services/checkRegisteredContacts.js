import apiService from './apiService';

// ✅ named export - import { checkRegisteredContacts } se match kare
export const checkRegisteredContacts = async (phones = []) => {
    try {
        if (!phones.length) return { registered: [], users: {} };

        const response = await apiService({
            method: 'POST',
            endpoint: 'users/sync-contacts',
            data: { contacts: phones },
        });
        return response?.data || { registered: [], users: {} };
    } catch (error) {
        console.log('checkRegisteredContacts error:', error?.response || error);
        return { registered: [], users: {} };
    }
};