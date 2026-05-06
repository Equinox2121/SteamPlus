import React, { createContext, useContext, useState, useEffect } from 'react';

const TOKEN_KEY = 'sp_jwt';
const USER_KEY = 'sp_user';
const AuthContext = createContext();

const readCachedUser = () => {
    try {
        const raw = localStorage.getItem(USER_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
};

const writeCachedUser = (u) => {
    try {
        if (u) localStorage.setItem(USER_KEY, JSON.stringify(u));
        else localStorage.removeItem(USER_KEY);
    } catch {}
};

export const AuthProvider = ({ children }) => {
    const initialToken = typeof window !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null;
    const initialUser = initialToken ? readCachedUser() : null;
    const [user, setUser] = useState(initialUser);
    const [loading, setLoading] = useState(!!initialToken && !initialUser);

    const persistUser = (u) => {
        setUser(u);
        writeCachedUser(u);
    };

    const fetchUser = () => {
        const token = typeof window !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null;
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
                    persistUser({ username: data.username, avatar: data.avatar || null });
                    console.info('[auth] verified via /user as', data.username);
                } else {
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

    useEffect(() => {
        fetchUser();
    }, []);

    return (
        <AuthContext.Provider value={{ user, loading, logout, fetchUser, login, register, completeSteamProfile }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
