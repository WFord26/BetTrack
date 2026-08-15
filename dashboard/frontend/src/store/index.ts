import { configureStore } from '@reduxjs/toolkit';
import betSlipReducer from './betSlipSlice';
import clvReducer from './clvSlice';
import movementReducer from './movementSlice';
import sharpReducer from './sharpSlice';
import bookmakerReducer from './bookmakerSlice';
import arbitrageReducer from './arbitrageSlice';

export const store = configureStore({
  reducer: {
    betSlip: betSlipReducer,
    clv: clvReducer,
    movements: movementReducer,
    sharp: sharpReducer,
    bookmaker: bookmakerReducer,
    arbitrage: arbitrageReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
