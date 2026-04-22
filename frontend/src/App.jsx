import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';

import Home from './pages/Home';
import Friends from './pages/Friends';
import Profile from './pages/Profile';
import CompleteProfile from './pages/CompleteProfile';
import Game from './pages/Game';
import Navbar from './pages/Navbar';
import { AuthProvider } from './context/AuthContext';

function AppContent() {
    const location = useLocation();

    return (
        <div>
            <Navbar />
            {/* Route Definitions */}
            <Routes>
                <Route path="/" element={<Navigate to="/home" replace />} />
                <Route path="/home" element={<Home />} />
                <Route path="/friends" element={<Friends />} />
                <Route path="/login" element={<Home />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/complete-profile" element={<CompleteProfile />} />
                <Route path="/game/:appid" element={<Game />} />
            </Routes>
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