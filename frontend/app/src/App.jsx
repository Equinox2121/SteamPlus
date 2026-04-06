import { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import axios from 'axios';

import Home from './pages/Home';
import LandingPage from './pages/Login';
import Register from './pages/Register';
import SignIn from './pages/SignIn';

function App() {
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  // 1. Persistent Auth Check
  useEffect(() => {
    const verifyAuth = async () => {
      const API_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';
      try {
        // Call /auth/test route to see if our cookie is valid
        const res = await axios.get(`${API_URL}/auth/test`, { withCredentials: true });
        if (res.status === 200) {
          setAuthenticated(true);
        }
      } catch (err) {
        setAuthenticated(false);
      } finally {
        setLoading(false);
      }
    };
    verifyAuth();
  }, []);

  // Show nothing (or a spinner) while checking the cookie
  if (loading) return null; 

  return (
    <Router>
      <Routes>
        <Route path="/" element={<LandingPage />} />

        <Route 
            path="/Register" 
            element={authenticated ? <Navigate to="/home" /> : <Register />} />

        <Route 
            path="/SignIn" 
            element={
            authenticated ? (
                <Navigate to="/home" />
            ) : (
                <SignIn setAuthenticated={setAuthenticated} />
            )
          } />

        <Route 
            path="/home" 
            element={
            authenticated ? (
                <Home setAuthenticated={setAuthenticated} />
            ) : (
                <Navigate to="/SignIn" />
            )
          } />
        </Routes>
    </Router>
  );
}

export default App;