import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import apiService from '../../services/apiService';

const initialState = {
    plans: [],
    plansEnabled: true,
    plansReason: null,
    freeLimits: null,
    paymentModes: null,
    plansLoading: false,
    plansError: null,

    me: null, // { entitlements, usage }
    meLoading: false,
    meError: null,

    history: [],
    historyPagination: null,
    historyCurrent: null, // GET plans/history `current` (PlanHistory top card fallback)
    historyLoading: false,
    historyError: null,
};

// GET /api/plans — plan catalogue + free-tier limits + which payment modes are live
export const fetchPlans = createAsyncThunk('plans/fetchPlans', async (_, thunkAPI) => {
    try {
        const res = await apiService({ method: 'GET', endpoint: 'plans' });
        if (!res?.success || res.data?.success === false) return thunkAPI.rejectWithValue(res?.error?.message || 'Could not load plans');
        return res.data.data;
    } catch (error) {
        return thunkAPI.rejectWithValue(error.message);
    }
});

// GET /api/plans/me — current plan + per-limit usage
export const fetchMyPlan = createAsyncThunk('plans/fetchMyPlan', async (_, thunkAPI) => {
    try {
        const res = await apiService({ method: 'GET', endpoint: 'plans/me' });
        if (!res?.success || res.data?.success === false) return thunkAPI.rejectWithValue(res?.error?.message || 'Could not load your plan');
        return res.data.data;
    } catch (error) {
        return thunkAPI.rejectWithValue(error.message);
    }
});

// GET /api/plans/history — paginated past subscriptions
export const fetchPlanHistory = createAsyncThunk('plans/fetchPlanHistory', async ({ page = 1, limit = 20 } = {}, thunkAPI) => {
    try {
        const res = await apiService({ method: 'GET', endpoint: 'plans/history', params: { page, limit } });
        if (!res?.success || res.data?.success === false) return thunkAPI.rejectWithValue(res?.error?.message || 'Could not load plan history');
        return { ...res.data.data, page };
    } catch (error) {
        return thunkAPI.rejectWithValue(error.message);
    }
});

const plansSlice = createSlice({
    name: 'plans',
    initialState,
    reducers: {},
    extraReducers: (builder) => {
        builder
            .addCase(fetchPlans.pending, (state) => { state.plansLoading = true; state.plansError = null; })
            .addCase(fetchPlans.fulfilled, (state, action) => {
                state.plansLoading = false;
                state.plans = action.payload?.plans ?? [];
                state.plansEnabled = action.payload?.enabled !== false;
                state.plansReason = action.payload?.reason ?? null;
                state.freeLimits = action.payload?.freeLimits ?? null;
                state.paymentModes = action.payload?.payment ?? null;
            })
            .addCase(fetchPlans.rejected, (state, action) => { state.plansLoading = false; state.plansError = action.payload || action.error.message; })

            .addCase(fetchMyPlan.pending, (state) => { state.meLoading = true; state.meError = null; })
            .addCase(fetchMyPlan.fulfilled, (state, action) => { state.meLoading = false; state.me = action.payload ?? null; })
            .addCase(fetchMyPlan.rejected, (state, action) => { state.meLoading = false; state.meError = action.payload || action.error.message; })

            .addCase(fetchPlanHistory.pending, (state) => { state.historyLoading = true; state.historyError = null; })
            .addCase(fetchPlanHistory.fulfilled, (state, action) => {
                state.historyLoading = false;
                const { history = [], pagination = null, page, current = null } = action.payload || {};
                if (page === 1 || current) state.historyCurrent = current;
                state.history = page > 1 ? [...state.history, ...history] : history;
                state.historyPagination = pagination;
            })
            .addCase(fetchPlanHistory.rejected, (state, action) => { state.historyLoading = false; state.historyError = action.payload || action.error.message; });
    },
});

export default plansSlice.reducer;
