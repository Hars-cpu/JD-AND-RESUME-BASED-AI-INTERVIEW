/**
 * @file authSlice.js
 * @description Redux Toolkit slice managing global user authentication state.
 * Handles API interactions and state transitions for user register, login, session check, and logout.
 */

import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import axiosClient from './utils/axiosClient'

/**
 * Register User Async Thunk
 * Dispatches a POST request to register a new user account.
 */
export const registerUser = createAsyncThunk(
  'auth/register',
  async (userData, { rejectWithValue }) => {
    try {
      const response =  await axiosClient.post('/user/register', userData);
      return response.data.user; // Dispatched as payload to extraReducers.fulfilled
    } catch (error) {
      return rejectWithValue(error.response?.data || { message: 'Registration failed' });
    }
  }
);

/**
 * Login User Async Thunk
 * Dispatches a POST request to authenticate credentials and initiate a session.
 */
export const loginUser = createAsyncThunk(
  'auth/login',
  async (credentials, { rejectWithValue }) => {
    try {
      const response = await axiosClient.post('/user/login', credentials);
      return response.data.user; // Dispatched as payload to extraReducers.fulfilled
    } catch (error) {
      return rejectWithValue(error.response?.data || { message: 'login failed' });
    }
  }
);

/**
 * Check Authentication Session Async Thunk
 * Contacts backend endpoint using HTTP cookies to verify existing active session.
 */
export const checkAuth = createAsyncThunk(
  'auth/check',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await axiosClient.get('/user/check',{
        withCredentials: true // Includes cookies containing JWT token automatically
      });
      return data.user;
    } catch (error) { 
      if (error.response?.status === 401) {
        return rejectWithValue(null); // Silently fails with null if token is missing/expired
      }
      return rejectWithValue(error.response?.data || { message: 'checking failed' });
    }
  }
);

/**
 * Logout User Async Thunk
 * Triggers logout request on server to clear token cookie.
 */
export const logoutUser = createAsyncThunk(
  'auth/logout',
  async (_, { rejectWithValue }) => {
    try {
      await axiosClient.post('/user/logout');
      return null; // Signals client-side auth state teardown
    } catch (error) {
      return rejectWithValue(error.response?.data || { message: 'logout failed' });
    }
  }
);

/**
 * Authentication Redux Slice Configuration
 * Controls authentication state transitions under 'auth' key.
 */
const authSlice = createSlice({
  name: 'auth',
  initialState: {
    user: null,             // User information payload (role, username, email)
    isAuthenticated: false, // Flag signaling active authentication status
    loading: false,         // Loading toggle for splash/loading layouts
    error: null             // Tracks authentication/connection failures
  },
  reducers: {
    // Clear error message in local store state
    clearError: (state) => {
      state.error = null;
    }
  },
  extraReducers: (builder) => {
    builder
      // Register User Cases
      .addCase(registerUser.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(registerUser.fulfilled, (state, action) => {
        state.loading = false;
        state.isAuthenticated = !!action.payload;
        state.user = action.payload;
      })
      .addCase(registerUser.rejected, (state, action) => {
        state.loading = false;
        state.error = typeof action.payload === 'string' ? action.payload : (action.payload?.message || 'Registration failed');
        state.isAuthenticated = false;
        state.user = null;
      })
  
      // Login User Cases
      .addCase(loginUser.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(loginUser.fulfilled, (state, action) => {
        state.loading = false;
        state.isAuthenticated = !!action.payload;
        state.user = action.payload;
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.loading = false;
        state.error = typeof action.payload === 'string' ? action.payload : (action.payload?.message || 'Login failed');
        state.isAuthenticated = false;
        state.user = null;
      })
  
      // Check Auth Cases
      .addCase(checkAuth.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(checkAuth.fulfilled, (state, action) => {
        state.loading = false;
        state.isAuthenticated = !!action.payload;
        state.user = action.payload;
      })
      .addCase(checkAuth.rejected, (state, action) => {
        state.loading = false;
        state.error = null; // Do not show global error for checkAuth
        state.isAuthenticated = false;
        state.user = null;
      })
  
      // Logout User Cases
      .addCase(logoutUser.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(logoutUser.fulfilled, (state) => {
        state.loading = false;
        state.user = null;
        state.isAuthenticated = false;
        state.error = null;
      })
      .addCase(logoutUser.rejected, (state, action) => {
        state.loading = false;
        state.error = typeof action.payload === 'string' ? action.payload : (action.payload?.message || 'Logout failed');
        state.isAuthenticated = false;
        state.user = null;
      });
  }
});

export const { clearError } = authSlice.actions;
export default authSlice.reducer;