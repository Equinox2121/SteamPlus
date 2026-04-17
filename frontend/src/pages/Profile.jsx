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


    const [stats, setStats] = useState({ recentPlaytime: 0, activeGames: 0, totalGames: 0, accountLevel: 0 });
    const [statsLoading, setStatsLoading] = useState(false);

    const [activeGameStats, setActiveGameStats] = useState(null);
    const [showOverlayId, setShowOverlayId] = useState(null);
    const [statsLoadingGame, setStatsLoadingGame] = useState(false);

    
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
                    totalGames: data.totalGamesOwned || 0,
                    accountLevel: data.steamLevel || 0
                });
            })
            .catch(err => console.error("Stats fetch failed:", err))
            .finally(() => setStatsLoading(false));
    };

    const fetchGameSpecificStats = (appid) => {
        setShowOverlayId(appid);
        setActiveGameStats(null);
        setStatsLoadingGame(true);

        fetch(`${import.meta.env.VITE_BACKEND_URL}/steam/game-stats/${appid}`, {
            credentials: 'include'
        })
            .then(res => res.json())
            .then(data => setActiveGameStats(data))
            .catch(err => {
                console.error(err);
                setShowOverlayId(null);
            })
            .finally(() => setStatsLoadingGame(false));
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

                    <div className="stats-dashboard">
                        <div className="dash-stat">
                            <span className="label">Steam Level</span>
                            <span className="value">{stats.accountLevel}</span>
                        </div>
                        <div className="dash-stat border-left">
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

                    <h3 className="section-title">Your Steam Library</h3>
                    {gamesLoading ? (
                        <p>Loading your games...</p>
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
                                        <div className="game-name-container">
                                            <div className="game-name-text">{game.name}</div>
                                            <button className="stats-icon-btn" onClick={(e) => {
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
                    {showOverlayId && (
                        <div className="stats-overlay" onClick={() => setShowOverlayId(null)}>
                            <div className="stats-modal" onClick={(e) => e.stopPropagation()}>

                                {/* CLOSE BUTTON */}
                                <button 
                                    className="close-btn"
                                    onClick={() => setShowOverlayId(null)}
                                >
                                    ✕
                                </button>

                                {statsLoadingGame ? (
                                    <p>Loading stats...</p>
                                ) : activeGameStats ? (
                                    <>
                                        <h3 className="modal-title">Game Stats</h3>

                                        <div className="achievements-header">
                                            <h4>Achievements:</h4>
                                            <span className="achievement-progress">
                                                {activeGameStats.unlocked} / {activeGameStats.total} Unlocked
                                            </span>
                                        </div>

                                        <div className="achievements-grid">
                                            {activeGameStats.achievements.slice(0, 12).map((ach, i) => (
                                                <div key={i} className={`achievement ${ach.unlocked ? 'unlocked' : 'locked'}`}>
                                                    {ach.icon && <img src={ach.icon} alt={ach.name} />}
                                                    <div>{ach.name}</div>
                                                    <small>{ach.rarity}% players</small>
                                                </div>
                                            ))}
                                        </div>

                                        {activeGameStats.customStats.length > 0 && (
                                            <>
                                                <h4>Game Stats</h4>
                                                <ul>
                                                    {activeGameStats.customStats.slice(0, 5).map((s, i) => (
                                                        <li key={i}>
                                                            <strong>{s.label}:</strong> {s.value}
                                                        </li>
                                                    ))}
                                                </ul>
                                            </>
                                        )}
                                    </>
                                ) : (
                                    <p>No stats available.</p>
                                )}
                            </div>
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