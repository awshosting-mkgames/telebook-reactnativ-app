// src/redux/slices/appDataSlice.js
import { createSlice } from '@reduxjs/toolkit';

const initialState = {
    lang: 'en',
    country: 'in',
    location: {},
    bannerUrl: '',
    iconUrl: '',
    userType: null,
    user: null,
    otherData: null,
    isLogin: null,
    apiToken: null,
    userId: null
   
};

const totalappDataSlice = createSlice({
    name: 'totalappData',
    initialState,
    reducers: {
        // Login time – full data set
        settotalappData: (state, action) => {
            return {
                ...state,
                ...action.payload,
            };
        },
        // Update only `user` from API
        updateUserData: (state, action) => {
           
            state.user = {
                ...state.user,
                ...action.payload,
            };
        },

        // Optional: clear all data on logout
        resetAppData: () => initialState,
    },
});

export const { settotalappData, updateUserData, resetAppData } = totalappDataSlice.actions;
export default totalappDataSlice.reducer;
