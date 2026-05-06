import React, { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

import Navbar from './pages/Navbar';
import Loader from './components/Loader';
import { AuthProvider } from './context/AuthContext';
import { idlePrefetchRoutes, warmBackend } from './utils/prefetch';

const Home = lazy(() => import('./pages/Home'));
const Friends = lazy(() => import('./pages/Friends'));
const Profile = lazy(() => import('./pages/Profile'));
const CompleteProfile = lazy(() => import('./pages/CompleteProfile'));
const Game = lazy(() => import('./pages/Game'));
const Support = lazy(() => import('./pages/Support'));
const Search = lazy(() => import('./pages/Search'));
const Community = lazy(() => import('./pages/Community'));

const routeLoaders = [
    () => import('./pages/Home'),
    () => import('./pages/Friends'),
    () => import('./pages/Game'),
    () => import('./pages/Profile'),
    () => import('./pages/Support'),
    () => import('./pages/CompleteProfile'),
    () => import('./pages/Search'),
    () => import('./pages/Community'),
];

function AppContent() {
    useEffect(() => {
        idlePrefetchRoutes(routeLoaders);
        warmBackend();
    }, []);

    return (
        <div>
            <Navbar />
            <Suspense fallback={<div className="home-container"><Loader variant="page" /></div>}>
                <Routes>
                    <Route path="/" element={<Navigate to="/home" replace />} />
                    <Route path="/home" element={<Home />} />
                    <Route path="/friends" element={<Friends />} />
                    <Route path="/login" element={<Home />} />
                    <Route path="/profile" element={<Profile />} />
                    <Route path="/complete-profile" element={<CompleteProfile />} />
                    <Route path="/game/:appid" element={<Game />} />
                    <Route path="/search" element={<Search />} />
                    <Route path="/community" element={<Community />} />
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
