import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

// CRITICAL: Import your Home component file
import Home from './pages/Home';
import Login from './pages/Login';

function App() {
    return (
        <Router>
            <div >
                
                {/* Route Definitions */}
                <Routes>
                    <Route path="/" element={<Navigate to="/login" replace />} />
                    <Route path="/login" element={<Login />} />
                    <Route path="/home" element={<Home />} />
                </Routes>
            </div>
        </Router>
    );
}

export default App;