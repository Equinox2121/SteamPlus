import React, { useEffect, useState } from 'react';
import { useNavigate } from "react-router-dom";

function Home() {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    const [games, setGames] = useState([]);
    const [gamesLoading, setGamesLoading] = useState(false);
    const [gamesError, setGamesError] = useState("");

    const navigate = useNavigate();

    const fetchUser = () => {
        fetch('http://localhost:5000/user', { credentials: 'include' })
            .then(res => res.json())
            .then(data => {
                if (data.loggedIn) {
                    setUser(data.username);
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
        fetch('http://localhost:5000/steam/library', { credentials: 'include' })
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
            await fetch('http://localhost:5000/logout', {
                method: 'POST',
                credentials: 'include'
            });

            navigate("/login"); // redirect to login page
        } catch (e) {
            console.error(e);
        }
    };

    return (
        <div style={{ padding: '20px' }}>
            {loading ? (
                <p>Loading...</p>
            ) : user ? (
                <>
                    <h2>Welcome, {user}!</h2>

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
    );
}

export default Home;