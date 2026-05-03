import React, { useState } from 'react';
import './LoginModal.css';
import logo from '../assets/SteamPlus Logo.png';
import { useAuth } from '../context/AuthContext';
//cleanup needed
const LoginModal = ({ isOpen, onClose }) => {
    const { login, register } = useAuth();
    const [isRegisterMode, setIsRegisterMode] = useState(false);
    const [formData, setFormData] = useState({
        email: '',
        username: '',
        password: ''
    });
    const [error, setError] = useState(null);
    const [message, setMessage] = useState(null);

    const [mouseDownOnOverlay, setMouseDownOnOverlay] = useState(false);

    if (!isOpen) return null;

    const handleMouseDown = (e) => {
        if (e.target === e.currentTarget) {
            setMouseDownOnOverlay(true);
        } else {
            setMouseDownOnOverlay(false);
        }
    };

    const handleMouseUp = (e) => {
        if (mouseDownOnOverlay && e.target === e.currentTarget) {
            onClose();
        }
        setMouseDownOnOverlay(false);
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        setError(null);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);
        setMessage(null);

        if (isRegisterMode) {
            const result = await register(formData.email, formData.username, formData.password);
            if (result.success) {
                setMessage('Registration successful! Please login.');
                setIsRegisterMode(false);
            } else {
                setError(result.error);
            }
        } else {
            const result = await login(formData.username, formData.password);
            if (result.success) {
                onClose();
            } else {
                setError(result.error);
            }
        }
    };

    return (
        <div 
            className="modal-overlay" 
            onMouseDown={handleMouseDown} 
            onMouseUp={handleMouseUp}
        >
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <button className="modal-close-btn" onClick={onClose}>&times;</button>
                <div className="login-modal-body">
                    <h1 style={{ marginBottom: '20px', fontSize: '24px', textAlign: 'center', color: '#ffffff' }}>
                        {isRegisterMode ? 'Create Account' : 'Sign In'}
                    </h1>
                    
                    <div className="login-logo" style={{ textAlign: 'center', marginBottom: '20px' }}>
                        <img src={logo} alt="SteamPlus Logo" style={{ width: '150px' }} />
                    </div>

                    <form onSubmit={handleSubmit} className="login-form">
                        {isRegisterMode && (
                            <div className="input-group">
                                <label>Email Address</label>
                                <input 
                                    type="email" 
                                    name="email" 
                                    value={formData.email} 
                                    onChange={handleInputChange} 
                                    required 
                                />
                            </div>
                        )}
                        <div className="input-group">
                            <label>Username</label>
                            <input 
                                type="text" 
                                name="username" 
                                value={formData.username} 
                                onChange={handleInputChange} 
                                required 
                            />
                        </div>
                        <div className="input-group">
                            <label>Password</label>
                            <input 
                                type="password" 
                                name="password" 
                                value={formData.password} 
                                onChange={handleInputChange} 
                                required 
                            />
                        </div>

                        {error && <p className="error-message">{error}</p>}
                        {message && <p className="success-message">{message}</p>}

                        <button type="submit" className="login-form-btn">
                            {isRegisterMode ? 'Register' : 'Sign In'}
                        </button>
                    </form>

                    <div className="login-separator">
                        <span>OR</span>
                    </div>

                    <div className="login-buttons">
                        <p style={{ color: '#c6d4df', fontSize: '13px', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '1px', textAlign: 'center' }}>
                            Use your Steam account to log in
                        </p>
                        <a href={`${import.meta.env.VITE_BACKEND_URL}/auth/steam?return_to=${encodeURIComponent(window.location.origin)}`} className="steam-btn" style={{ display: 'block', textDecoration: 'none', textAlign: 'center' }}>
                            Sign in with Steam
                        </a>
                        
                        <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                            <button 
                                className="secondary-btn" 
                                style={{ flex: 1 }} 
                                onClick={() => setIsRegisterMode(!isRegisterMode)}
                            >
                                {isRegisterMode ? 'Back to Login' : 'Create Account'}
                            </button>
                            <button className="secondary-btn" style={{ flex: 1 }}>Help</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LoginModal;
