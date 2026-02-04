import { configureStore } from '@reduxjs/toolkit';
import betSlipReducer from './betSlipSlice';
import clvReducer from './clvSlice';

export const store = configureStore({
  reducer: {
    betSlip: betSlipReducer,
    clv: clvReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
