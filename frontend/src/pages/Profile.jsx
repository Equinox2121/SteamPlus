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
                <div className="login-content-loading">
                    <p>Loading...</p>
                </div>
            ) : user ? (
                <>
                    {/* --- HEADER SECTION --- */}
                    <div className="header-section">
                        <img
                            src={user.avatar || noAvatar}
                            alt={`${user.username}'s avatar`}
                            className="avatar-img"
                            onError={(e) => { e.currentTarget.src = noAvatar; }}
                        />
                        <div className="header-text">
                            <h2>Welcome, {user.username}!</h2>
                        </div>
                        <button onClick={handleLogout} className="logout-btn">Logout</button>
                    </div>

                    {/* --- STATS DASHBOARD --- */}
                    <div className="stats-dashboard">
                        <div className="dash-stat">
                            <span className="label">Recent Playtime</span>
                            <span className="value">{stats.recentPlaytime} hrs</span>
                        </div>
                        <div className="dash-stat border-left">
                            <span className="label">Library Size</span>
                            <span className="value">{stats.totalGames || games.length}</span>
                        </div>
                        <div className="dash-stat border-left">
                            <span className="label">Active Games</span>
                            <span className="value">{stats.activeGames}</span>
                        </div>
                    </div>

                    {/* --- LIBRARY GRID --- */}
                    <h3 className="section-title">Your Steam Library</h3>
                    {gamesLoading ? (
                        <p>Loading your games...</p>
                    ) : gamesError ? (
                        <p className="error-text">{gamesError}</p>
                    ) : (
                        <div className="library-container">
                            {games.map(game => (
                                <div key={game.appid} className="game-card">
                                    <div className="game-image-container" onClick={() => navigate(`/game/${game.appid}`)}>
                                        <img
                                            src={game.header_image}
                                            alt={game.name}
                                            className="game-image"
                                            onError={(e) => { e.currentTarget.src = 'https://community.cloudflare.steamstatic.com/public/images/applications/community/unknown_game.jpg'; }}
                                        />
                                    </div>
                                    <div className="game-info">
                                        <div className="game-name-container">
                                            <span className="game-name-text">{game.name}</span>
                                            <button 
                                                className="stats-icon-btn"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    fetchGameSpecificStats(game.appid);
                                                }}
                                            >
                                                <img src={statsIcon} alt="Stats" />
                                            </button>
                                        </div>
                                        {game.playtime_forever !== undefined && (
                                            <div className="playtime-text">
                                                {Math.round(game.playtime_forever / 60)} hours on record
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* --- STATS MODAL --- */}
                    {showOverlayId && (
                        <div className="stats-modal-backdrop" onClick={() => setShowOverlayId(null)}>
                            <div className="stats-modal-content" onClick={e => e.stopPropagation()}>
                                <div className="modal-header">
                                    <h3>{games.find(g => g.appid === showOverlayId)?.name} Stats</h3>
                                    <button className="close-modal-x" onClick={() => setShowOverlayId(null)}>&times;</button>
                                </div>

                                {activeGameStats ? (
                                    <div className="modal-body">
                                        <div className="stat-summary-row">
                                            <div className="stat-pill">
                                                <label>Completion</label>
                                                <span>{activeGameStats.percentage}%</span>
                                            </div>
                                            <div className="stat-pill">
                                                <label>Unlocked</label>
                                                <span>{activeGameStats.unlocked} / {activeGameStats.total}</span>
                                            </div>
                                        </div>

                                        <div className="modal-charts">
                                            <h4>Achievement Rarity</h4>
                                            <ResponsiveContainer width="100%" height={120}>
                                                <BarChart data={activeGameStats.achievements?.slice(0, 8)}>
                                                    <Tooltip 
                                                        contentStyle={{ backgroundColor: '#171a21', border: '1px solid #66c0f4', fontSize: '12px' }}
                                                        itemStyle={{ color: '#66c0f4' }}
                                                    />
                                                    <Bar dataKey="rarity" fill="#66c0f4" />
                                                </BarChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="modal-loading">
                                        <p>Fetching Steam Data...</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </>
            ) : (
                <div className="login-content-prompt">
                    <h2>Welcome</h2>
                    <p>You are not logged in.</p>
                    <button onClick={() => navigate("/login")} className="steam-btn">Go to Login</button>
                </div>
            )}
        </div>
    );
}

export default Profile;