import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

// CRITICAL: Import your Home component file
import Home from './pages/Home';
import LandingPage from './pages/Login';
import Register from './pages/Register';
import SignIn from './pages/SignIn';

function App() {
    return (
        <Router>
            <div >
                
                {/* Route Definitions */}
                <Routes>
                    <Route path="/home" element={<Home />} />
                    <Route path="/" element={<LandingPage />} />
                    <Route path="/Register" element={<Register />} />
                    <Route path="/SignIn" element={<SignIn />} />
                    
                </Routes>
            </div>
        </Router>
    );
}

export default App;