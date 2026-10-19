import apiService from '../services/apiService';

// Name ya mobile se registered users dhundho. Server '+91 98765 43210' jaisa format khud handle karta hai.
// Returns users array ([] agar koi nahi / error). `signal` optional — stale response ignore karne ke liye caller check karta hai.
export const searchUserByPhone = async (query = '', { page = 1, limit = 20 } = {}) => {
    try {
        const q = String(query || '').trim();
        if (!q) return [];
        const response = await apiService({
            method: 'GET',
            endpoint: 'users/search',
            params: { query: q, page, limit },
        });
        return response?.data?.users || response?.data?.data?.users || [];
    } catch (error) {
        return [];
    }
};

// Pagination info ke saath (Home search 'Load more' ke liye)
export const searchUsersPaged = async (query = '', { page = 1, limit = 20 } = {}) => {
    try {
        const q = String(query || '').trim();
        if (!q) return { users: [], hasMore: false };
        const response = await apiService({
            method: 'GET',
            endpoint: 'users/search',
            params: { query: q, page, limit },
        });
        const d = response?.data?.users ? response.data : response?.data?.data || {};
        const users = d.users || [];
        const pg = d.pagination || {};
        const hasMore = pg.hasMore ?? (pg.totalPages ? (pg.page || page) < pg.totalPages : users.length >= limit);
        return { users, hasMore: !!hasMore };
    } catch (e) {
        return { users: [], hasMore: false };
    }
};

export default searchUserByPhone;
