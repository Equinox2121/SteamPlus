import React, {useEffect, useState} from 'react';
import { Navigate } from 'react-router-dom';
import './Login.css';
import logo from '../assets/SteamPlus Logo.png';

function Login() {

    const [user, setUser] = useState(null);


    const fetchUser = () => {
        fetch(`${import.meta.env.VITE_BACKEND_URL}/user`, { credentials: "include" })
            .then(res => res.json())
            .then(data => {
                if (data.loggedIn) {
                    setUser(data.username);
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
                    <a href={`${import.meta.env.VITE_BACKEND_URL}/auth/steam`} className="steam-btn">
                        Sign in with Steam
                    </a>
                    <button className="account-btn">Create an account</button>
                    <hr style={{width: '100%', border: '0.5px solid gray'}} />
                    <button className="account-btn">Contact Us 📞</button>
                </div>

                <div className="login-logo">
                    <img src={logo} alt="SteamPlus Logo" className="logo-img" />
                </div>
            </div>
        </div>
    );
}

export default Login; 