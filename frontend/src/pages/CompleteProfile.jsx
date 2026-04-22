import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import logo from '../assets/SteamPlus Logo.png';
import './LoginModal.css';

const CompleteProfile = () => {
    const { completeSteamProfile } = useAuth();
    const [username, setUsername] = useState('');
    const [error, setError] = useState(null);
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);

        const result = await completeSteamProfile(username);
        if (result.success) {
            navigate('/home');
        } else {
            setError(result.error);
        }
    };

    return (
        <div className="complete-profile-container" style={{ 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center', 
            height: '100vh', 
            backgroundColor: '#1b2838' 
        }}>
            <div className="modal-content" style={{ position: 'relative', width: '400px' }}>
                <div className="login-modal-body">
                    <h1 style={{ marginBottom: '20px', fontSize: '24px', textAlign: 'center', color: '#ffffff' }}>
                        Choose a Username
                    </h1>
                    
                    <div className="login-logo" style={{ textAlign: 'center', marginBottom: '20px' }}>
                        <img src={logo} alt="SteamPlus Logo" style={{ width: '150px' }} />
                    </div>

                    <p style={{ color: '#c6d4df', textAlign: 'center', marginBottom: '20px' }}>
                        Welcome! Please choose a unique username to complete your Steam registration.
                    </p>

                    <form onSubmit={handleSubmit} className="login-form">
                        <div className="input-group">
                            <label>Username</label>
                            <input 
                                type="text" 
                                name="username" 
                                value={username} 
                                onChange={(e) => setUsername(e.target.value)} 
                                required 
                                autoFocus
                            />
                        </div>

                        {error && <p className="error-message">{error}</p>}

                        <button type="submit" className="login-form-btn">
                            Complete Profile
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default CompleteProfile;
