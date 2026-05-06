import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import logo from '../assets/SteamPlus Logo.png';
import noAvatar from '../assets/NoAvatar.png';
import { useAuth } from '../context/AuthContext';
import { searchSteam, prefetchGame, prefetchDeals, preloadImage } from '../utils/prefetch';
import Loader from '../components/Loader';
import './Navbar.css';
import './Search.css';
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

    const prefetchRoute = (path) => {
        switch (path) {
            case '/home': import('./Home'); break;
            case '/friends': import('./Friends'); break;
            case '/profile': import('./Profile'); break;
            case '/support': import('./Support'); break;
            case '/search': import('./Search'); break;
            case '/community': import('./Community'); break;
            default: break;
        }
    };

    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [searchOpen, setSearchOpen] = useState(false);
    const [activeIdx, setActiveIdx] = useState(-1);
    const searchBoxRef = useRef(null);
    const debounceRef = useRef(null);
    const abortRef = useRef(null);

    useEffect(() => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        if (abortRef.current) abortRef.current.abort();
        const q = searchQuery.trim();
        if (q.length < 2) {
            setSearchResults([]);
            return;
        }
        debounceRef.current = setTimeout(() => {
            const ctrl = new AbortController();
            abortRef.current = ctrl;
            searchSteam(q, { limit: 8, signal: ctrl.signal })
                .then((data) => {
                    setSearchResults(data.results || []);
                    setActiveIdx(-1);
                })
                .catch(() => {});
        }, 200);
        return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
    }, [searchQuery]);

    useEffect(() => {
        const handler = (e) => {
            if (searchBoxRef.current && !searchBoxRef.current.contains(e.target)) {
                setSearchOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const goToResult = (g) => {
        setSearchOpen(false);
        setSearchQuery('');
        navigate(`/game/${g.appid}`);
    };

    const goToSearchPage = () => {
        const q = searchQuery.trim();
        if (q.length < 2) return;
        setSearchOpen(false);
        navigate(`/search?q=${encodeURIComponent(q).replace(/%20/g, '+')}`);
    };

    const handleKeyDown = (e) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActiveIdx((i) => Math.min(i + 1, searchResults.length - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActiveIdx((i) => Math.max(i - 1, -1));
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (activeIdx >= 0 && searchResults[activeIdx]) {
                goToResult(searchResults[activeIdx]);
            } else {
                goToSearchPage();
            }
        } else if (e.key === 'Escape') {
            setSearchOpen(false);
        }
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
                            onMouseEnter={() => prefetchRoute('/home')}
                            onFocus={() => prefetchRoute('/home')}
                        >
                            Store
                        </a>
                        <a
                            href="#"
                            className={`navbar-link ${location.pathname === '/friends' ? 'active' : ''}`}
                            onClick={(e) => { e.preventDefault(); navigate('/friends'); }}
                            onMouseEnter={() => prefetchRoute('/friends')}
                            onFocus={() => prefetchRoute('/friends')}
                        >
                            Friends
                        </a>
                        <a
                            href="#"
                            className={`navbar-link ${location.pathname === '/community' ? 'active' : ''}`}
                            onClick={(e) => { e.preventDefault(); navigate('/community'); }}
                            onMouseEnter={() => prefetchRoute('/community')}
                            onFocus={() => prefetchRoute('/community')}
                        >
                            Community
                        </a>
                        <a
                            href="#"
                            className={`navbar-link ${location.pathname === '/support' ? 'active' : ''}`}
                            onClick={(e) => { e.preventDefault(); navigate('/support'); }}
                            onMouseEnter={() => prefetchRoute('/support')}
                            onFocus={() => prefetchRoute('/support')}
                        >
                            Support
                        </a>
                    </div>
                </div>

                    <div className="navbar-search" ref={searchBoxRef}>
                        <input
                            type="text"
                            className="navbar-search-input"
                            placeholder="Search games..."
                            value={searchQuery}
                            onChange={(e) => { setSearchQuery(e.target.value); setSearchOpen(true); }}
                            onFocus={() => { setSearchOpen(true); prefetchRoute('/search'); }}
                            onKeyDown={handleKeyDown}
                            aria-label="Search games"
                        />
                        {searchOpen && searchQuery.trim().length >= 2 && (
                            <div className="navbar-search-dropdown" role="listbox">
                                {searchResults.length === 0 ? (
                                    <div className="navbar-search-empty"><Loader variant="inline" label="Searching" /></div>
                                ) : (
                                    <>
                                        {searchResults.map((g, idx) => (
                                            <div
                                                key={g.appid}
                                                className={`navbar-search-item ${idx === activeIdx ? 'active' : ''}`}
                                                onMouseEnter={() => { setActiveIdx(idx); prefetchGame(g.appid); prefetchDeals(g.appid, g.name); preloadImage(g.header_image); }}
                                                onMouseDown={(e) => { e.preventDefault(); goToResult(g); }}
                                                role="option"
                                                aria-selected={idx === activeIdx}
                                            >
                                                <img src={g.header_image} alt="" className="navbar-search-thumb" loading="lazy" decoding="async" />
                                                <span className="navbar-search-name">{g.name}</span>
                                            </div>
                                        ))}
                                        <div className="navbar-search-footer" onMouseDown={(e) => { e.preventDefault(); goToSearchPage(); }}>
                                            See all results for "{searchQuery.trim()}"
                                        </div>
                                    </>
                                )}
                            </div>
                        )}
                    </div>

                <div className="navbar-right">
                    {!loading && (
                        user ? (
                            <div
                                className={`profile-section ${location.pathname === '/profile' ? 'active' : ''}`}
                                onClick={() => navigate('/profile')}
                                onMouseEnter={() => prefetchRoute('/profile')}
                                onFocus={() => prefetchRoute('/profile')}
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
                                    loading="eager"
                                    decoding="async"
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
