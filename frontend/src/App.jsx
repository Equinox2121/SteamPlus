import React, { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

import Navbar from './pages/Navbar';
import { AuthProvider } from './context/AuthContext';
import { idlePrefetchRoutes, warmBackend } from './utils/prefetch';

const Home = lazy(() => import('./pages/Home'));
const Friends = lazy(() => import('./pages/Friends'));
const Profile = lazy(() => import('./pages/Profile'));
const CompleteProfile = lazy(() => import('./pages/CompleteProfile'));
const Game = lazy(() => import('./pages/Game'));
const Support = lazy(() => import('./pages/Support'));
const Search = lazy(() => import('./pages/Search'));

const routeLoaders = [
    () => import('./pages/Home'),
    () => import('./pages/Friends'),
    () => import('./pages/Game'),
    () => import('./pages/Profile'),
    () => import('./pages/Support'),
    () => import('./pages/CompleteProfile'),
    () => import('./pages/Search'),
];

function AppContent() {
    useEffect(() => {
        idlePrefetchRoutes(routeLoaders);
        warmBackend();
    }, []);

    return (
        <div>
            <Navbar />
            <Suspense fallback={<div className="home-container"><p style={{ padding: '24px' }}>Loading...</p></div>}>
                <Routes>
                    <Route path="/" element={<Navigate to="/home" replace />} />
                    <Route path="/home" element={<Home />} />
                    <Route path="/friends" element={<Friends />} />
                    <Route path="/login" element={<Home />} />
                    <Route path="/profile" element={<Profile />} />
                    <Route path="/complete-profile" element={<CompleteProfile />} />
                    <Route path="/game/:appid" element={<Game />} />
                    <Route path="/search" element={<Search />} />
                    <Route path="/support" element={<Support />} />
                </Routes>
            </Suspense>
        </div>
    );
}

function App() {
    return (
        <AuthProvider>
            <Router>
                <AppContent />
            </Router>
        </AuthProvider>
    );
}

export default App;
