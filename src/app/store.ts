import { configureStore } from "@reduxjs/toolkit";
import modalReducer from "../features/modals/modalSlice";
import importsReducer from "../features/imports/importsSlice";

const store = configureStore({
  reducer: {
    "modals": modalReducer,
    "imports": importsReducer,
  },
  devTools: process.env.NODE_ENV !== "production",
});

export default store;

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
