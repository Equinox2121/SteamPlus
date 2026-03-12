<<<<<<< HEAD
import React, { useEffect, useState } from 'react';

//this is an Example Steam Login button and should be replaced
=======
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { useState } from 'react';

// CRITICAL: Import your Home component file
import Home from './pages/Home';
import Login from './pages/login';
>>>>>>> main

function App() {
    const [user, setUser] = useState(null);

    const fetchUser = () => {
        fetch("http://localhost:5000/user", { credentials: "include" })
            .then(res => res.json())
            .then(data => {
                if (data.loggedIn) setUser(data.username);
            })
            .catch(err => console.error(err));
    };

    useEffect(() => {

        fetchUser();

        const timer = setTimeout(fetchUser, 100);
        return () => clearTimeout(timer);
    }, []);

    const steamLogin = () => {
        window.location.href = "http://localhost:5000/auth/steam";
    };

    return (
<<<<<<< HEAD
        <div style={{ textAlign: 'center', marginTop: '50px' }}>
            {user ? (
                <p>Welcome, {user}!</p>
            ) : (
                <button
                    onClick={steamLogin}
                    style={{
                        padding: "12px 20px",
                        fontSize: "18px",
                        cursor: "pointer",
                        borderRadius: "6px",
                        backgroundColor: "#171a21",
                        color: "white",
                        border: "none"
                    }}
                >
                    Login with Steam
                </button>
            )}
        </div>
=======
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
>>>>>>> main
    );
}

export default App;