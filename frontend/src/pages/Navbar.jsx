import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import logo from '../assets/SteamPlus Logo.png';
import noAvatar from '../assets/NoAvatar.png';
import { useAuth } from '../context/AuthContext';
import './Navbar.css';
import LoginModal from './LoginModal';

const Navbar = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { user, loading, logout } = useAuth();
    const [isLoginModalOpen, setLoginModalOpen] = useState(false);

    React.useEffect(() => {
        if (location.pathname === '/login') {
            setLoginModalOpen(true);
        }
    }, [location.pathname]);

    const handleLogout = async (e) => {
        e.stopPropagation();
        await logout(() => navigate("/home"));
    };

    const handleLoginClick = () => {
        setLoginModalOpen(true);
    };

    const closeLoginModal = () => {
        setLoginModalOpen(false);
    };

    return (
        <nav className="navbar">
            <div className="navbar-content">
                <div className="navbar-left">
                    <div 
                        className="navbar-logo" 
                        onClick={() => navigate('/home')}
                        role="button"
                        tabIndex="0"
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate('/home'); } }}
                        aria-label="SteamPlus Home"
                    >
                        <img src={logo} alt="" aria-hidden="true" />
                        <span>SteamPlus</span>
                    </div>
                    <div className="navbar-links">
                        <a 
                            href="#" 
                            className={`navbar-link ${location.pathname === '/home' ? 'active' : ''}`}
                            onClick={(e) => { e.preventDefault(); navigate('/home'); }}
                        >
                            Store
                        </a>
                        <a 
                            href="#" 
                            className={`navbar-link ${location.pathname === '/friends' ? 'active' : ''}`}
                            onClick={(e) => { e.preventDefault(); navigate('/friends'); }}
                        >
                            Friends
                        </a>
                        <a href="#" className="navbar-link">Community</a>
                        <a href="#" className="navbar-link">About</a>
                        <a
                            href="#"
                            className={`navbar-link ${location.pathname === '/support' ? 'active' : ''}`}
                            onClick={(e) => { e.preventDefault(); navigate('/support'); }}
                        >
                            Support
                        </a>
                    </div>
                </div>

                <div className="navbar-right">
                    {!loading && (
                        user ? (
                            <div 
                                className={`profile-section ${location.pathname === '/profile' ? 'active' : ''}`} 
                                onClick={() => navigate('/profile')}
                                role="button"
                                tabIndex="0"
                                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate('/profile'); } }}
                                aria-label="View Profile"
                            >
                                <span className="profile-name">{user.username}</span>
                                <img 
                                    src={user.avatar || noAvatar} 
                                    alt="" 
                                    className="profile-avatar" 
                                    aria-hidden="true" 
                                    onError={(e) => { e.currentTarget.src = noAvatar; }}
                                />
                                <div className="profile-dropdown">
                                    <button 
                                        className="dropdown-logout-btn" 
                                        onClick={handleLogout}
                                        aria-label="Logout"
                                    >
                                        Logout
                                    </button>
                                </div>
                            </div>
                        ) : (
                            location.pathname !== '/complete-profile' && (
                                <button className="nav-login-btn" onClick={handleLoginClick}>
                                    Login
                                </button>
                            )
                        )
                    )}
                </div>
            </div>
            <LoginModal isOpen={isLoginModalOpen} onClose={closeLoginModal} />
        </nav>
    );
};

export default Navbar;
