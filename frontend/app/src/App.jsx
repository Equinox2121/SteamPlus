import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { useState } from 'react';

// CRITICAL: Import your Home component file
import Home from './pages/Home';
import Login from './pages/login';

function App() {
    return (
        <Router>
            <div style={{ textAlign: 'center', marginTop: '50px' }}>
                <h1>CS330 Project Baseline</h1>
                
                {/* Navigation Links */}
                <nav style={{ marginBottom: '20px' }}>
                    <Link to="/">Login</Link>
                    <Link to="/home">Home</Link>
                </nav>

                {/* Route Definitions */}
                <Routes>
                    <Route path="/" element={<Login />} />
                    <Route path="/home" element={<Home />} />
                </Routes>
            </div>
        </Router>
    );
}

export default App;