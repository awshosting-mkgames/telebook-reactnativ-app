// src/redux/reducers/rootReducer.js
import { combineReducers } from '@reduxjs/toolkit';
import userDataSlice from '../slices/userDataSlice';
import totalappDataSlice from '../slices/totalappDataSlice';
import chatListSlice from '../slices/chatListSlice';
import contactsSlice from '../slices/contactsSlice';

const rootReducer = combineReducers({
    userData: userDataSlice,
    totalappData:totalappDataSlice,
    chatList: chatListSlice,
     contacts:     contactsSlice,
});

export default rootReducer;
