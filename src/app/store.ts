import { configureStore } from "@reduxjs/toolkit";
import modalReducer from "../features/modals/modalSlice";

const store = configureStore({
  reducer: {
    "modals": modalReducer,
  },
  devTools: process.env.NODE_ENV !== "production",
});

export default store;

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
