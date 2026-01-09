import { configureStore } from '@reduxjs/toolkit';
import betSlipReducer from './betSlipSlice';

export const store = configureStore({
  reducer: {
    betSlip: betSlipReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
