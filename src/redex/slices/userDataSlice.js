import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import apiService from '../../services/apiService';

const initialState = {
    userData: null,
    loading: false,
    error: null,
};

// Async thunk for fetching user data
export const fetchuserData = createAsyncThunk(
    'user/fetch',
    async ({ type }, thunkAPI) => {
        try {
            const response = await apiService({
                method: 'GET',
                endpoint: `me/profile`,
            });
            return response.data; 
        } catch (error) {
            return thunkAPI.rejectWithValue(error.message);
        }
    }
);

// Slice definition
const userDataSlice = createSlice({
    name: 'userData',
    initialState,
    reducers: {},
    extraReducers: (builder) => {
        builder
            .addCase(fetchuserData.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchuserData.fulfilled, (state, action) => {
                state.loading = false;
                state.userData = action.payload;
            })
            .addCase(fetchuserData.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload || action.error.message;
            });
    },
});

export default userDataSlice.reducer;
