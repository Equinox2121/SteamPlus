import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    const fetchUser = () => {
        setLoading(true);
        fetch(`${import.meta.env.VITE_BACKEND_URL}/user`, { credentials: "include" })
            .then(res => res.json())
            .then(data => {
                if (data.loggedIn) {
                    setUser({ username: data.username, avatar: data.avatar || null });
                } else {
                    setUser(null);
                }
            })
            .catch(err => {
                console.error('error fetching user:', err);
                setUser(null);
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
            setUser(null);
            if (callback) callback();
        } catch (e) {
            console.error('error logging out:', e);
        }
    };

    const completeSteamProfile = async (username) => {
        try {
            const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/auth/complete-steam-profile`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username }),
                credentials: 'include'
            });
            const data = await res.json();
            if (res.ok) {
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
