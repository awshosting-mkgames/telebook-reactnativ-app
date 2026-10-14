import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import apiService from '../../services/apiService';

const initialState = {
    wallet: null, // { balance, totalCredited, totalDebited, lastTxAt, packs, currency, payment, rates, talkTimeSeconds }
    walletLoading: false,
    walletError: null,

    transactions: [],
    txPagination: null,
    txType: 'all', // all | credit | debit
    txLoading: false,
    txError: null,
};

// GET /api/wallet — balance, talk-time estimate, coin packs, rates
export const fetchWallet = createAsyncThunk('wallet/fetchWallet', async (_, thunkAPI) => {
    try {
        const res = await apiService({ method: 'GET', endpoint: 'wallet' });
        if (!res?.success || res.data?.success === false) return thunkAPI.rejectWithValue(res?.error?.message || 'Could not load wallet');
        return res.data.data;
    } catch (error) {
        return thunkAPI.rejectWithValue(error.message);
    }
});

// GET /api/wallet/transactions?type&page&limit
export const fetchWalletTransactions = createAsyncThunk(
    'wallet/fetchWalletTransactions',
    async ({ type = 'all', page = 1, limit = 20 } = {}, thunkAPI) => {
        try {
            const res = await apiService({ method: 'GET', endpoint: 'wallet/transactions', params: { type, page, limit } });
            if (!res?.success || res.data?.success === false) return thunkAPI.rejectWithValue(res?.error?.message || 'Could not load transactions');
            return { ...res.data.data, type, page };
        } catch (error) {
            return thunkAPI.rejectWithValue(error.message);
        }
    }
);

const walletSlice = createSlice({
    name: 'wallet',
    initialState,
    reducers: {},
    extraReducers: (builder) => {
        builder
            .addCase(fetchWallet.pending, (state) => { state.walletLoading = true; state.walletError = null; })
            .addCase(fetchWallet.fulfilled, (state, action) => { state.walletLoading = false; state.wallet = action.payload ?? null; })
            .addCase(fetchWallet.rejected, (state, action) => { state.walletLoading = false; state.walletError = action.payload || action.error.message; })

            .addCase(fetchWalletTransactions.pending, (state) => { state.txLoading = true; state.txError = null; })
            .addCase(fetchWalletTransactions.fulfilled, (state, action) => {
                state.txLoading = false;
                const { transactions = [], pagination = null, type, page } = action.payload || {};
                // Tab badalne par list reset, pagination par append
                state.transactions = (page > 1 && type === state.txType) ? [...state.transactions, ...transactions] : transactions;
                state.txPagination = pagination;
                state.txType = type;
            })
            .addCase(fetchWalletTransactions.rejected, (state, action) => { state.txLoading = false; state.txError = action.payload || action.error.message; });
    },
});

export default walletSlice.reducer;
