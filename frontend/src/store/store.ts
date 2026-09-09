import { configureStore, combineReducers } from '@reduxjs/toolkit';
import {
  persistReducer,
  persistStore,
  FLUSH,
  REHYDRATE,
  PAUSE,
  PERSIST,
  PURGE,
  REGISTER,
} from 'redux-persist';
import createWebStorage from 'redux-persist/lib/storage/createWebStorage';
import { baseApi } from './api/baseApi';
import authReducer from '@/modules/auth/store/authSlice';
import { authPersistence } from './authPersistence';
import { errorInterceptor } from './middleware/errorInterceptor';

/**
 * Create a noop storage for server-side rendering
 * Prevents redux-persist from trying to access localStorage during SSR
 */
const createNoopStorage = () => {
  return {
    getItem() {
      return Promise.resolve(null);
    },
    setItem(_key: string, value: string) {
      return Promise.resolve(value);
    },
    removeItem() {
      return Promise.resolve();
    },
  };
};

/**
 * Use browser localStorage only when running in the browser
 * Falls back to noop storage during SSR
 */
const storage = typeof window !== 'undefined' ? createWebStorage('local') : createNoopStorage();

/**
 * Root reducer combining slices
 */
const rootReducer = combineReducers({
  // RTK Query API reducer
  [baseApi.reducerPath]: baseApi.reducer,
  // Persisted auth slice reducer
  auth: persistReducer(authPersistence(storage), authReducer),
});

/**
 * Redux store configuration with RTK Query integration and redux-persist
 * Middleware order: errorInterceptor → RTK Query → defaults
 */
export const store = configureStore({
  reducer: rootReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        // Ignore redux-persist actions
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
      },
    })
      .concat(errorInterceptor) // Error interceptor MUST be before RTK Query
      .concat(baseApi.middleware),
  devTools: process.env.NODE_ENV !== 'production',
});

/**
 * Persistor for redux-persist
 * Used in PersistGate to delay rendering until state is rehydrated
 */
export const persistor = persistStore(store);

// Infer RootState and AppDispatch types from the store
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
