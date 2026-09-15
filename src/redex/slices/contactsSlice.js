import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import apiService from '../../services/apiService';

const initialState = {
    contacts:  [],
    loading:   false,
    saving:    false,
    error:     null,
    hasSynced: false, // pehli sync ho chuki hai → auto-sync dobara nahi hogi
};

// ── GET: server pe cached contacts lo → Redux mein save karo ─────────────────
export const fetchCachedContacts = createAsyncThunk(
    'contacts/fetchCached',
    async (_, thunkAPI) => {
        try {
            const response = await apiService({
                method:   'GET',
                endpoint: 'contact-cache',
            });
            const raw = response?.data?.data;
            if (raw && typeof raw === 'string') {
                return JSON.parse(raw); 
            }
            return response?.data?.contacts ?? response?.data ?? [];
        } catch (error) {
            return thunkAPI.rejectWithValue(error.message);
        }
    }
);

// ── PUT: processed contacts server pe save karo + Redux update karo ──────────
export const saveContacts = createAsyncThunk(
    'contacts/save',
    async (processedContacts, thunkAPI) => {
        try {
            await apiService({
                method:   'PUT',
                endpoint: 'contact-cache',
                data:     { data: JSON.stringify(processedContacts) },
            });
             console.log("====================================Put Conatct Ca;;;;;;;;",processedContacts)
            return processedContacts; // same data Redux mein bhi set hoga
        } catch (error) {
            return thunkAPI.rejectWithValue(error.message);
        }
    }
);

// ── Slice ─────────────────────────────────────────────────────────────────────
const contactsSlice = createSlice({
    name: 'contacts',
    initialState,
    reducers: {
        clearContacts: (state) => {
            state.contacts  = [];
            state.hasSynced = false;
            state.error     = null;
        },
    },
    extraReducers: (builder) => {
        builder
            // GET cached
            .addCase(fetchCachedContacts.pending,   (state)         => { state.loading = true;  state.error = null; })
            .addCase(fetchCachedContacts.fulfilled, (state, action) => { state.loading = false; state.contacts = action.payload; })
            .addCase(fetchCachedContacts.rejected,  (state, action) => { state.loading = false; state.error = action.payload; })

            // PUT save
            .addCase(saveContacts.pending,   (state)         => { state.saving = true;  state.error = null; })
            .addCase(saveContacts.fulfilled, (state, action) => {
                state.saving    = false;
                state.contacts  = action.payload; // processed data Redux mein
                state.hasSynced = true;           // sync complete flag
            })
            .addCase(saveContacts.rejected,  (state, action) => {
                state.saving    = false;
                state.hasSynced = false;
                state.error     = action.payload;
            });
    },
});

export const { clearContacts } = contactsSlice.actions;
export default contactsSlice.reducer;
