/**
 * Login.js
 * 
 * This component provides a login form that authenticates the user.
 * Upon successful login, it updates the authentication state and navigates to the map page.
 *
 * NOTE:
 * - Backend issues an HTTP-only cookie on successful login.
 * - We must send requests with `withCredentials: true` so the browser accepts the cookie.
 * - The backend routes are mounted at `/auth/*`, so use `/auth/login` here.
 */

import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate, Link } from 'react-router-dom';

/**
 * Login component allows users to enter credentials to access the app.
 * @param {Function} setAuthenticated - Function to update the app's authentication state.
 * @returns {JSX.Element} The login form.
 */
const Login = ({ setAuthenticated }) => {
  const [username, setUsername]   = useState('');
  const [password, setPassword]   = useState('');
  const navigate                  = useNavigate();

  // Base API URL for the backend (e.g., http://localhost:5175)
  const API_URL = import.meta.env.VITE_API_URL || '';
  const LOGIN_URL = `${API_URL}/auth/login`;

  console.log('Sending Login Request to:', LOGIN_URL);

  /**
   * handleSubmit
   * 
   * Handles form submission by sending credentials to the backend for verification.
   * Updates authentication state and navigates to the map page upon success.
   * 
   * @param {Object} e - Event object from the form submission.
   * @async
   * @function
   */
  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const response = await axios.post(
        LOGIN_URL,
        { username, password },
        {
          // Required so the browser will accept the HTTP-only cookie set by the backend
          withCredentials: true,
          headers: { 'Content-Type': 'application/json' },
        }
      );

      // Backend returns 200 + { message: 'Login successful' } on success
      if (response.status === 200) {
        setAuthenticated(true);
        // Redirect to the app’s main page (Map). Use `/map` to skip extra redirect hops.
        navigate('/map', { replace: true });
      } else {
        alert('Login failed. Please check your credentials.');
      }
    } catch (error) {
      // Common causes:
      // - 401 Invalid credentials
      // - CORS / cookie not accepted (check FRONTEND_URL, credentials:true on server, withCredentials here)
      // - Backend not running or wrong URL
      console.error('Login failed:', error);
      alert('Invalid credentials or unable to reach the server.');
      setAuthenticated(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', maxWidth: '300px' }}>
      <h2>Login</h2>
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="username"
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
        />
        <button type="submit">Login</button>
      </form>

      {/* Link to the Register page */}
      <p style={{ marginTop: '10px' }}>
        Don’t have an account? <Link to="/register">Register here</Link>
      </p>
    </div>
  );
};

export default Login;