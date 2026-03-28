import React, {useEffect, useState} from 'react';
import { Link, Navigate } from 'react-router-dom';
import './Login.css';
import logo from '../assets/SteamPlus Logo.png';

function Login() {

    const [user, setUser] = useState(null);

    const fetchUser = () => {
        fetch(`${import.meta.env.VITE_BACKEND_URL}/auth/test`, { credentials: "include" })
        .then(res => res.json())
        .then(data => {
            if (data.ok) { // Template returns { ok: true, user: ... }
                setUser(data.user.username);
            } else {
                setUser(null);
            }
        })
        .catch(err => console.error(err));
    };

    useEffect(() => {

        fetchUser();

        const timer = setTimeout(fetchUser, 100);
        return () => clearTimeout(timer);
    }, []);

    return (
        <div className="login-container">
            <h1>Welcome to SteamPlus!</h1>
            
            <div className="login-content">
                <div className="login-buttons">
                    <a href={`${import.meta.env.VITE_BACKEND_URL}/auth/steam`} className="steam-login-btn">
                        Sign in with Steam
                    </a>

                    <Link to="/SignIn" className="general-login-btn">
                        Sign in
                    </Link>

                    <Link to="/Register" className="create-account-btn">
                        Create an account
                    </Link>

                    <hr style={{width: '100%', border: '0.5px solid gray'}} />
                    <button className="contact-btn">Contact Us 📞</button>
                </div>

                <div className="login-logo">
                    <img src={logo} alt="SteamPlus Logo" className="logo-img" />
                </div>
            </div>
        </div>
    );
}

export default Login; 