import React, { useEffect, useState } from 'react';
import { useNavigate } from "react-router-dom";
import { useAuth } from '../context/AuthContext';
import noAvatar from '../assets/NoAvatar.png';
import statsIcon from '../assets/Stats_Icon.png';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts';
import './Store.css';
import './Profile.css';

function Profile() {
    const { user, loading, logout } = useAuth();
    const [games, setGames] = useState([]);
    const [gamesLoading, setGamesLoading] = useState(false);
    const [gamesError, setGamesError] = useState("");



    // stats.totalGames will now be populated from the backend
    const [stats, setStats] = useState({ recentPlaytime: 0, activeGames: 0, totalGames: 0 });
    const [statsLoading, setStatsLoading] = useState(false);

    const [activeGameStats, setActiveGameStats] = useState(null); 
    const [showOverlayId, setShowOverlayId] = useState(null);

    
    const navigate = useNavigate();

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


    const fetchGlobalStats = () => {
        setStatsLoading(true);
        fetch(`${import.meta.env.VITE_BACKEND_URL}/steam/user-stats`, { credentials: 'include' })
            .then(res => res.json())
            .then(data => {
                setStats({
                    recentPlaytime: data.recentPlaytimeHrs || 0,
                    activeGames: data.recentGamesCount || 0,
                    totalGames: data.totalGamesOwned || 0 // Match the backend addition
                });
            })
            .catch(err => console.error("Stats fetch failed:", err))
            .finally(() => setStatsLoading(false));
    };

    const fetchGameSpecificStats = (appid) => {
        setShowOverlayId(appid);
        setActiveGameStats(null); 
        fetch(`${import.meta.env.VITE_BACKEND_URL}/steam/game-stats/${appid}`, { credentials: 'include' })
            .then(res => res.json())
            .then(data => setActiveGameStats(data))
            .catch(err => {
                console.error(err);
                setShowOverlayId(null);
            });
    };


    useEffect(() => {
        if (user) {
            fetchLibrary();
            fetchGlobalStats();
        } else {
            setGames([]);
            setGamesLoading(false);
            setGamesError("");
        }
    }, [user]);

    const handleLogout = async () => {
        await logout(() => navigate("/login"));
    };

        return (
        <div className="home-container">
            {loading ? (
                <div className="login-content" style={{ margin: 'auto' }}>
                    <p>Loading...</p>
                </div>
            ) : user ? (
                <>
                    <div className="header-section">
                        <img
                            src={user.avatar || noAvatar}
                            alt={`${user.username}'s avatar`}
                            className="avatar-img"
                            onError={(e) => { e.currentTarget.src = noAvatar; }}
                        />
                        <h2 style={{ margin: 0 }}>Welcome, {user.username}!</h2>
                    </div>

                    <h3 className="section-title">Your Steam Library</h3>
                    {gamesLoading ? (
                        <p>Loading your games...</p>
                    ) : gamesError ? (
                        <p style={{ color: '#ff4b4b' }}>{gamesError}</p>
                    ) : games.length === 0 ? (
                        <p>No games found or your library may be private.</p>
                    ) : (
                        <div className="library-container">
                            {games.map(game => (
                                <div 
                                    key={game.appid} 
                                    className="game-card"
                                    onClick={() => navigate(`/game/${game.appid}`)}
                                >
                                    <div className="game-image-container">
                                        <img
                                            src={game.header_image}
                                            alt={game.name}
                                            className="game-image"
                                            onError={(e) => { e.currentTarget.src = 'https://community.cloudflare.steamstatic.com/public/images/applications/community/unknown_game.jpg'; }}
                                        />
                                    </div>
                                    <div className="game-info">
                                        <div style={{ fontWeight: '500', color: '#ffffff' }}>{game.name}</div>
                                        {game.playtime_forever !== undefined && (
                                            <div style={{ fontSize: '11px', color: '#8f98a0', marginTop: '4px' }}>
                                                {Math.round(game.playtime_forever / 60)} hours on record
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                </>
            ) : (
                <div className="login-content" style={{ margin: '100px auto' }}>
                    <h2>Welcome</h2>
                    <p>You are not logged in.</p>
                    <button onClick={() => navigate("/login")} className="steam-btn">Go to Login</button>
                </div>
            )}
        </div>
    );
}

export default Profile;