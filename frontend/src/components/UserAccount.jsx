import React, { useEffect, useState } from 'react';
import { useNavigate } from "react-router-dom";
import noAvatar from "../assets/NoAvatar.png";
import statsIcon from "../assets/Stats_Icon.png";
import gearIcon from "../assets/Gear_Icon.png";
import "../pages/Store.css";
import "../pages/Profile.css";

const UserHeader = ({ user, isSteamUser }) => {
    const [showPrivacy, setShowPrivacy] = useState(false);
    
    useEffect(() => {
        if (!showPrivacy) return;

        const timer = setTimeout(() => {
            setShowPrivacy(false);
        }, 5000);

        return () => clearTimeout(timer);
    }, [showPrivacy]);

    return (
        <div className="header-section">
            {isSteamUser && (
                <div className="gear-wrapper">
                    <button
                        className="header-gear-btn"
                        onClick={() => setShowPrivacy(true)}
                    >
                    <img src={gearIcon} alt="Settings" />
                    </button>

                    {showPrivacy && (
                        <div className="privacy-popup">
                            Privacy settings are inherited from Steam.
                        </div>
                    )}
                </div>
            )}  

            <img
                src={user.avatar || noAvatar}
                alt={`${user.username}'s avatar`}
                className="avatar-img"
                onError={(e) => { e.currentTarget.src = noAvatar; }}
            />

            <h2 style={{ margin: 0 }}>Welcome, {user.username}!</h2>
        </div>
    );
};

const StatsDashboard = ({
    stats,
    gamesCount,
    showExpanded,
    toggleExpandedStats,
    extendedStats,
    extendedLoading
}) => (
    <div className={`stats-dashboard ${showExpanded ? "expanded" : ""}`}>
        <div className="stats-toggle" onClick={toggleExpandedStats}>
            {showExpanded ? "Show less" : "Show more"}
        </div>

        <div className="stats-row" onClick={toggleExpandedStats}>
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
                <span className="value">{stats.totalGames || gamesCount}</span>
            </div>

            <div className="dash-stat border-left chevron-container">
                <span className="label">Active Games</span>
                <span className="value">{stats.activeGames}</span>
            </div>
        </div>

        {showExpanded && (
            <div className="expanded-row">
                {extendedLoading ? (
                    <p>Loading...</p>
                ) : extendedStats && (
                    <>
                        <div className="dash-stat">
                            <span className="label">Achievements</span>
                            <span className="value">
                                {extendedStats.totalAchievementsUnlocked}/{extendedStats.totalAchievements}
                            </span>
                        </div>

                        <div className="dash-stat border-left">
                            <span className="label">Top Genres</span>
                            <span className="value small">
                                {extendedStats.topGenres?.join(", ") || "N/A"}
                            </span>
                        </div>

                        <div className="dash-stat border-left">
                            <span className="label">Most Played</span>
                            <span className="value small">
                                {extendedStats.mostPlayed?.name || "N/A"}
                            </span>
                        </div>

                        <div className="dash-stat border-left">
                            <span className="label">Average Game Playtime</span>
                            <span className="value">
                                {extendedStats.avgPlaytime || "N/A"} hrs
                            </span>
                        </div>
                    </>
                )}
            </div>
        )}
    </div>
);

const LibraryGrid = ({ games, loading, onGameClick, onStatsClick }) => {
    if (loading) return <p>Loading your games...</p>;

    return (
        <div className="library-container">
            {games.map(game => (
                <div
                    key={game.appid}
                    className="game-card"
                    onClick={() => onGameClick(game.appid)}
                >
                    <div className="game-image-container">
                        <img
                            src={game.header_image}
                            alt={game.name}
                            className="game-image"
                            onError={(e) => {
                                e.currentTarget.src =
                                    'https://community.cloudflare.steamstatic.com/public/images/applications/community/unknown_game.jpg';
                            }}
                        />
                    </div>

                    <div className="game-info">
                        <div className="game-name-container">
                            <div className="game-name-text">{game.name}</div>

                            <button
                                className="stats-icon-btn"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onStatsClick(game.appid);
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
    );
};

const GameStatsModal = ({ isOpen, onClose, loading, activeStats }) => {
    if (!isOpen) return null;

    return (
        <div className="stats-overlay" onClick={onClose}>
            <div className="stats-modal" onClick={(e) => e.stopPropagation()}>
                <button className="close-btn" onClick={onClose}>✕</button>

                {loading ? (
                    <p>Loading stats...</p>
                ) : activeStats ? (
                    <>
                        <h3 className="modal-title">Game Stats</h3>

                        <div className="achievements-header">
                            <h4>Achievements:</h4>
                            <span className="achievement-progress">
                                {activeStats.unlocked} / {activeStats.total} Unlocked
                            </span>
                        </div>

                        <div className="achievements-grid">
                            {activeStats.achievements.slice(0, 12).map((ach, i) => (
                                <div
                                    key={i}
                                    className={`achievement ${ach.unlocked ? 'unlocked' : 'locked'}`}
                                >
                                    {ach.icon && <img src={ach.icon} alt={ach.name} />}
                                    <div>{ach.name}</div>
                                    <small>{ach.rarity}% players</small>
                                </div>
                            ))}
                        </div>

                        {activeStats.customStats.length > 0 && (
                            <>
                                <h4>Game Stats</h4>
                                <ul>
                                    {activeStats.customStats.slice(0, 5).map((s, i) => (
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
    );
};

function UserAccount({ user, loading, logout }) {
    const [games, setGames] = useState([]);
    const [gamesLoading, setGamesLoading] = useState(false);

    const [stats, setStats] = useState({
        recentPlaytime: 0,
        activeGames: 0,
        totalGames: 0,
        accountLevel: 0
    });

    const [showExpanded, setShowExpanded] = useState(false);
    const [extendedStats, setExtendedStats] = useState(null);
    const [extendedLoading, setExtendedLoading] = useState(false);

    const [activeGameStats, setActiveGameStats] = useState(null);
    const [showOverlayId, setShowOverlayId] = useState(null);
    const [statsLoadingGame, setStatsLoadingGame] = useState(false);
    const [gameStatsCache, setGameStatsCache] = useState({});

    const [isSteamUser, setIsSteamUser] = useState(false);

    const navigate = useNavigate();

    const fetchLibrary = () => {
        setGamesLoading(true);

        fetch(`${import.meta.env.VITE_BACKEND_URL}/steam/library`, { credentials: 'include' })
            .then(res => {
                if (!res.ok) throw new Error('library failure');
                return res.json();
            })
            .then(data => {
                setGames(Array.isArray(data.games) ? data.games : []);
            })
            .catch(console.error)
            .finally(() => setGamesLoading(false));
    };

    const fetchUserStats = () => {
        fetch(`${import.meta.env.VITE_BACKEND_URL}/steam/user-stats`, { credentials: 'include' })
            .then(res => {
                if (!res.ok) throw new Error("not steam user"); 
                return res.json();
            })
            .then(data => {
                setStats({
                    recentPlaytime: data.recentPlaytimeHrs || 0,
                    activeGames: data.recentGamesCount || 0,
                    totalGames: data.totalGamesOwned || 0,
                    accountLevel: data.steamLevel || 0
                });

                setIsSteamUser(true);
            })
            .catch(err => {
                console.error("Stats fetch failed:", err);
                setIsSteamUser(false);
            });
    };

    const fetchExtendedUserStats = () => {
        setExtendedLoading(true);

        fetch(`${import.meta.env.VITE_BACKEND_URL}/steam/user-extended-stats`, {
            credentials: 'include'
        })
            .then(res => res.json())
            .then(setExtendedStats)
            .catch(console.error)
            .finally(() => setExtendedLoading(false));
    };

    const fetchGameSpecificStats = (appid) => {
        if (gameStatsCache[appid]) {
            setActiveGameStats(gameStatsCache[appid]);
            setShowOverlayId(appid);
            return;
        }

        setShowOverlayId(appid);
        setActiveGameStats(null);
        setStatsLoadingGame(true);

        fetch(`${import.meta.env.VITE_BACKEND_URL}/steam/game-stats/${appid}`, { credentials: 'include' })
            .then(res => res.json())
            .then(data => {
                setActiveGameStats(data);
                setGameStatsCache(prev => ({ ...prev, [appid]: data }));
            })
            .catch(err => {
                console.error(err);
                setShowOverlayId(null);
            })
            .finally(() => setStatsLoadingGame(false));
    };

    const toggleExpandedStats = () => {
        const next = !showExpanded;
        setShowExpanded(next);

        if (next && !extendedStats) {
            fetchExtendedUserStats();
        }
    };

    useEffect(() => {
        if (user) {
            fetchLibrary();
            fetchUserStats();
        } else {
            setGames([]);
        }
    }, [user]);

    if (loading) {
        return (
            <div className="home-container">
                <div className="login-content" style={{ margin: 'auto' }}>
                    <p>Loading...</p>
                </div>
            </div>
        );
    }

    if (!user) {
        return (
            <div className="home-container">
                <div className="login-content" style={{ margin: '100px auto' }}>
                    <h2>Welcome</h2>
                    <p>You are not logged in.</p>
                    <button
                        onClick={() => navigate("/login")}
                        className="steam-btn"
                    >
                        Go to Login
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="home-container">
            <UserHeader user={user} isSteamUser={isSteamUser} />

            <StatsDashboard
                stats={stats}
                gamesCount={games.length}
                showExpanded={showExpanded}
                toggleExpandedStats={toggleExpandedStats}
                extendedStats={extendedStats}
                extendedLoading={extendedLoading}
            />

            <h3 className="section-title">Your Steam Library</h3>

            <LibraryGrid
                games={games}
                loading={gamesLoading}
                onGameClick={(id) => navigate(`/game/${id}`)}
                onStatsClick={fetchGameSpecificStats}
            />

            <GameStatsModal
                isOpen={!!showOverlayId}
                onClose={() => setShowOverlayId(null)}
                loading={statsLoadingGame}
                activeStats={activeGameStats}
            />
        </div>
    );
}

export default UserAccount;