import apiService from '../services/apiService';

// ✅ Named export — import { searchUserByPhone } se match kare
export const searchUserByPhone = async (phone = '') => {
    try {
        if (!phone || phone.length < 10) return null;
        const response = await apiService({
            method: 'GET',
            endpoint: `users/search?query=${phone}`,
        });
        console.log('searchUserByPhone response:', response);
        return response?.data?.users || null;
    } catch (error) {
        console.log('searchUserByPhone error:', error?.response || error);
        return null;
    }
};