import apiService from './apiService';

// Response ke `users` / `registered` kabhi array to kabhi object-map aa sakte hain.
// Caller in par forEach karta hai, isliye hamesha array normalize karke dete hain.
const toArray = (value) => {
    if (Array.isArray(value)) return value;
    if (value && typeof value === 'object') return Object.values(value);
    return [];
};

// ✅ named export - import { checkRegisteredContacts } se match kare
export const checkRegisteredContacts = async (phones = []) => {
    if (!phones.length) return { registered: [], users: [] };

    const response = await apiService({
        method: 'POST',
        endpoint: 'users/sync-contacts',
        data: { contacts: phones },
    });

    // apiService HTTP error par throw nahi karta, { success: false } return karta hai.
    // Yahan throw karna zaroori hai: chup-chaap khali result dene par saare contacts
    // "unregistered" mark hokar server pe PUT ho jayenge aur registration flags mit jayenge.
    // Throw karne se caller full sync skip karke cached data load kar leta hai.
    if (!response?.success) {
        const detail = typeof response?.error === 'string'
            ? response.error
            : JSON.stringify(response?.error ?? {});
        throw new Error(`POST users/sync-contacts failed: ${detail}`);
    }

    const data = response.data ?? {};
    return {
        registered: toArray(data.registered),
        users: toArray(data.users),
    };
};
