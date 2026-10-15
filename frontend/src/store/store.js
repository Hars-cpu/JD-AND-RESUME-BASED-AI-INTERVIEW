/**
 * @file store.js
 * @description Configures and exports the global Redux store for the frontend application.
 * Utilizes Redux Toolkit's configureStore to set up the store with root reducers.
 */

import { configureStore } from '@reduxjs/toolkit';
import authReducer from '../authSlice';

// Global application store instance configuration
export const store = configureStore({
  reducer: {
    // Registers the authentication slice reducer to manage user session and loading states
    auth: authReducer
  }
});

