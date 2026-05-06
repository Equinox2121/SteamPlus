/**
 * AuthContext.jsx
 * 
 * Provides global authentication state and methods for the web application.
 * Handles login, registration, logout, session persistence, and user retrieval.
 * Uses React Context API so authentication state is accessible throughout the app.
 */

import React, { createContext, useContext, useState, useEffect } from 'react';

// Keys used for localStorage persistence
const TOKEN_KEY = 'sp_jwt';
const USER_KEY = 'sp_user';

const AuthContext = createContext();

/**
 * Reads cached user data from localStorage
 * Returns parsed user object or null if not found/invalid
 */
const readCachedUser = () => {
    try {
        const raw = localStorage.getItem(USER_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
};

/**
 * Writes user data to localStorage
 * Removes the item if u is null/undefined
 */
const writeCachedUser = (u) => {
    try {
        if (u) localStorage.setItem(USER_KEY, JSON.stringify(u));
        else localStorage.removeItem(USER_KEY);
    } catch {}
};

/**
 * AuthProvider wraps the application and provides auth state + functions
 */
export const AuthProvider = ({ children }) => {
    // Initialize user from cache if token exists, otherwise null
    const initialToken = typeof window !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null;
    const initialUser = initialToken ? readCachedUser() : null;
    
    // Global auth state
    const [user, setUser] = useState(initialUser);
    const [loading, setLoading] = useState(!!initialToken && !initialUser);

    /**
     * Updates user state and persists to localStorage
     */
    const persistUser = (u) => {
        setUser(u);
        writeCachedUser(u);
    };

    /**
     * Fetches current authenticated user from backend
     * Used to validate session and refresh user data
     */
    const fetchUser = () => {
        const token = typeof window !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null;

        // If no token exists, clear user state
        if (!token) {
            persistUser(null);
            setLoading(false);
            return;
        }
        setLoading(true);

        fetch(`${import.meta.env.VITE_BACKEND_URL}/user`, { credentials: "include" })
            .then(res => res.json())
            .then(data => {
                if (data.loggedIn) {
                    // Store authenticated user data
                    persistUser({ username: data.username, avatar: data.avatar || null });
                    console.info('[auth] verified via /user as', data.username);
                } else {
                    // Token invalid or expired - clear it
                    if (token) {
                        console.warn('[auth] /user returned loggedIn:false despite token in localStorage; clearing');
                        localStorage.removeItem(TOKEN_KEY);
                    }
                    persistUser(null);
                }
            })
            .catch(err => {
                console.error('[auth] /user fetch failed:', err);
                if (!token) persistUser(null);
            })
            .finally(() => setLoading(false));
    };

    /**
     * Logs user in and stores JWT token if successful
     */
    const login = async (username, password) => {
        try {
            const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
                credentials: 'include'
            });
            const data = await res.json();
            if (res.ok) {
                if (data.token) localStorage.setItem(TOKEN_KEY, data.token);
                fetchUser();
                return { success: true };
            }
            return { success: false, error: data.error };
        } catch (e) {
            console.error('Login error:', e);
            return { success: false, error: 'Network error' };
        }
    };

    /**
     * Registers a new user account (General Login)
     */
    const register = async (email, username, password) => {
        try {
            const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, username, password }),
                credentials: 'include'
            });
            const data = await res.json();
            if (res.ok) {
                return { success: true };
            }
            return { success: false, error: data.error };
        } catch (e) {
            console.error('Registration error:', e);
            return { success: false, error: 'Network error' };
        }
    };

    /**
     * Logs user out and clears authentication state
     */
    const logout = async (callback) => {
        try {
            await fetch(`${import.meta.env.VITE_BACKEND_URL}/logout`, {
                method: 'POST',
                credentials: 'include'
            });
        } catch (e) {
            console.error('error logging out:', e);
        } finally {
            localStorage.removeItem(TOKEN_KEY);
            persistUser(null);
            if (callback) callback();
        }
    };
  
    /**
     * Complete Steam profile setup after registration/login
     */
    const completeSteamProfile = async (username, pendingToken) => {
        try {
            const headers = { 'Content-Type': 'application/json' };
            if (pendingToken) headers.Authorization = `Bearer ${pendingToken}`;
            const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/auth/complete-steam-profile`, {
                method: 'POST',
                headers,
                body: JSON.stringify({ username }),
                credentials: 'include'
            });
            const data = await res.json();
            if (res.ok) {
                if (data.token) localStorage.setItem(TOKEN_KEY, data.token);
                fetchUser();
                return { success: true };
            }
            return { success: false, error: data.error };
        } catch (e) {
            console.error('Complete steam profile error:', e);
            return { success: false, error: 'Network error' };
        }
    };

    // Run once when the app loads to check if the user is already authenticated
    // This restores the session (if valid) so the user stays logged in after refresh
    useEffect(() => {
        fetchUser();
    }, []);

    return (
        <AuthContext.Provider value={{ user, loading, logout, fetchUser, login, register, completeSteamProfile }}>
            {children}
        </AuthContext.Provider>
    );
};

/**
 * Custom hook to access authentication context from other files
 * Ensures it is used within AuthProvider
 */
export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
