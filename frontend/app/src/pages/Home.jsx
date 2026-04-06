import React, { useEffect, useState } from 'react';
import { useNavigate } from "react-router-dom";
import './Login.css';

function Home({ setAuthenticated }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    const [games, setGames] = useState([]);
    const [gamesLoading, setGamesLoading] = useState(false);
    const [gamesError, setGamesError] = useState("");

    const navigate = useNavigate();

    const fetchUser = () => {
        fetch(`${import.meta.env.VITE_BACKEND_URL}/auth/user`, { credentials: 'include' })
            .then(res => res.json())
            .then(data => {
                if (data.loggedIn) {
                    setUser({ username: data.username, avatar: data.avatar || null });
                } else {
                    setUser(null);
                }
            })
            .catch(err => console.error(err))
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        fetchUser();
    }, []);

    const fetchLibrary = () => {
        setGamesLoading(true);
        setGamesError("");
        fetch(`${import.meta.env.VITE_BACKEND_URL}/steam/library`, { credentials: 'include' })
            .then(res => {
                if (!res.ok) throw new Error('library failure');
                return res.json();
            })
            .then(data => {
                setGames(Array.isArray(data.games) ? data.games : []);
            })
            .catch(err => {
                console.error(err);
                setGamesError('Could not load your Steam library.');
            })
            .finally(() => setGamesLoading(false));
    };

    useEffect(() => {
        if (user) {
            fetchLibrary(); //TOFIX: cascading renders
        } else {
            setGames([]);
            setGamesLoading(false);
            setGamesError("");
        }
    }, [user]);

    const logout = async () => {
        try {
            await fetch(`${import.meta.env.VITE_BACKEND_URL}/auth/logout`, {
                method: 'POST',
                credentials: 'include'
            });
            
            setAuthenticated(false); 
            navigate("/SignIn"); 
        } catch (e) {
            console.error(e);
        }
    };

    return (
        <div className="login-container">
            <div style={{ padding: '20px', width: '100%', maxWidth: '1000px' }}>
            {loading ? (
                <p>Loading...</p>
            ) : user ? (
                <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                        {user && user.avatar ? (
                            <img
                                src={user.avatar}
                                alt={`${user.username}'s avatar`}
                                style={{ width: '64px', height: '64px', borderRadius: '50%', objectFit: 'cover' }}
                                onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }}
                            />
                        ) : null}
                        <h2 style={{ margin: 0 }}>Welcome, {user ? user.username : ''}!</h2>
                    </div>

                    <h3 style={{ marginTop: '24px' }}>Your Steam Library</h3>
                    {gamesLoading ? (
                        <p>Loading your games...</p>
                    ) : gamesError ? (
                        <p style={{ color: 'red' }}>{gamesError}</p>
                    ) : games.length === 0 ? (
                        <p>No games found or your library may be private.</p>
                    ) : (
                        <div style={{ overflowX: 'auto', paddingBottom: '8px' }}>
                            <div style={{ display: 'flex', gap: '12px' }}>
                                {games.map(game => (
                                    <div key={game.appid} style={{
                                        flex: '0 0 auto',
                                        width: '220px'
                                    }}>
                                        <div style={{
                                            width: '220px',
                                            height: '103px',
                                            backgroundColor: '#1b2838',
                                            borderRadius: '6px',
                                            overflow: 'hidden',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center'
                                        }}>
                                            <img
                                                src={game.header_image}
                                                alt={game.name}
                                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                                onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                            />
                                        </div>
                                        <div style={{ marginTop: '6px', fontSize: '14px' }}>
                                            {game.name}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}


                    <button
                        onClick={logout}
                        className="account-btn"
                    >
                        Logout
                    </button>
                </>
            ) : (
                <>
                    <h2>Welcome</h2>
                    <p>You are not logged in.</p>
                </>
            )}
            </div>
        </div>
    );
}

export default Home;