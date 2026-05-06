/**
 * UserAccount.jsx
 *
 * Provides all data shown on Profile page for SteamPlus.
 * 
 * Responsibilities:
 * - Displays user profile header
 * - Shows Steam library games
 * - Renders user statistics and extended statistics data
 * - Handles game-specific stats/achievements modal
 * - Manages all Steam-related API calls
 * - Handles caching for performance optimization
 */

import React, { useEffect, useState } from 'react';
import { useNavigate } from "react-router-dom";
import noAvatar from "../assets/NoAvatar.png";
import statsIcon from "../assets/Stats_Icon.png";
import gearIcon from "../assets/Gear_Icon.png";
import "../pages/Store.css";
import "../pages/Profile.css";

/**
 * UserHeader component
 * Displays user avatar, username, and optional Steam privacy indicator
 */
const UserHeader = ({ user, isSteamUser }) => {
    const [showPrivacy, setShowPrivacy] = useState(false);
    
    /**
     * Auto-hide privacy popup after 5 seconds when triggered
     */
    useEffect(() => {
        if (!showPrivacy) return;

        const timer = setTimeout(() => {
            setShowPrivacy(false);
        }, 5000);

        return () => clearTimeout(timer);
    }, [showPrivacy]);

    return (
        <div className="header-section">
            {/* Steam-specific settings button - "Privacy settings inhertied from Steam" */}
            {isSteamUser && (
                <div className="gear-wrapper">
                    <button
                        className="header-gear-btn"
                        onClick={() => setShowPrivacy(true)}
                    >
                    <img src={gearIcon} alt="Settings" />
                    </button>

                    {/* Temporary privacy message popup */}
                    {showPrivacy && (
                        <div className="privacy-popup">
                            Privacy settings are inherited from Steam.
                        </div>
                    )}
                </div>
            )}  

            {/* User avatar with fallback image */}
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

/**
 * StatsDashboard component
 * Displays user-level and Steam gameplay statistics
 * Supports expandable detailed stats view
 */
const StatsDashboard = ({
    stats,
    gamesCount,
    showExpanded,
    toggleExpandedStats,
    extendedStats,
    extendedLoading
}) => (
    <div className={`stats-dashboard ${showExpanded ? "expanded" : ""}`}>

        {/* Toggle for expanded stats view */}
        <div className="stats-toggle" onClick={toggleExpandedStats}>
            {showExpanded ? "Show less" : "Show more"}
        </div>

        {/* Primary stats row - Shown by default */}
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

        {/* Expanded stats section (lazy loaded) */}
        {showExpanded && (
            <div className="expanded-row">

                {/* Loading state for extended stats */}
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

/**
 * LibraryGrid component
 * Displays user's Steam game library as a grid of game cards
 */
const LibraryGrid = ({ games, loading, onGameClick, onStatsClick }) => {

    // Loading state before games are fetched
    if (loading) return <p>Loading your games...</p>;

    return (
        <div className="library-container">

            {/* Render each game card */}
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

                            // Fallback image if Steam image fails
                            onError={(e) => {
                                e.currentTarget.src =
                                    'https://community.cloudflare.steamstatic.com/public/images/applications/community/unknown_game.jpg';
                            }}
                        />
                    </div>

                    <div className="game-info">
                        <div className="game-name-container">
                            <div className="game-name-text">{game.name}</div>

                            {/* Button to open game stats modal */}
                            <button
                                className="stats-icon-btn"
                                onClick={(e) => {
                                    e.stopPropagation(); // prevent card navigation when clicking stats icon
                                    onStatsClick(game.appid);
                                }}
                            >
                                <img src={statsIcon} alt="Stats" />
                            </button>
                        </div>
                        
                        {/* Playtime display on game card*/}
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

/**
 * GameStatsModal component
 * Displays detailed stats for a selected game in a modal overlay
 */
const GameStatsModal = ({ isOpen, onClose, loading, activeStats }) => {

    // Do not render modal if not active
    if (!isOpen) return null;

    return (
        <div className="stats-overlay" onClick={onClose}>
            <div className="stats-modal" onClick={(e) => e.stopPropagation()}>

                {/* Close button */}
                <button className="close-btn" onClick={onClose}>✕</button>

                {/* Loading / content states */}
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

                        {/* Achievement grid (limited preview) */}
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
                        
                        {/* Optional custom stats section for specific games */}
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

/**
 * Main UserAccount page component
 * Combines all subcomponents and handles data fetching + state management
 */
function UserAccount({ user, loading, logout }) {

    // Steam library state
    const [games, setGames] = useState([]);
    const [gamesLoading, setGamesLoading] = useState(false);

    // User stats/achievements state
    const [stats, setStats] = useState({
        recentPlaytime: 0,
        activeGames: 0,
        totalGames: 0,
        accountLevel: 0
    });

    // Expanded stats UI state
    const [showExpanded, setShowExpanded] = useState(false);
    const [extendedStats, setExtendedStats] = useState(null);
    const [extendedLoading, setExtendedLoading] = useState(false);

     // Game-specific modal state
    const [activeGameStats, setActiveGameStats] = useState(null);
    const [showOverlayId, setShowOverlayId] = useState(null);
    const [statsLoadingGame, setStatsLoadingGame] = useState(false);
    const [gameStatsCache, setGameStatsCache] = useState({});

    // Cache if Steam User (used for privacy settings popup)
    const [isSteamUser, setIsSteamUser] = useState(false);

    const navigate = useNavigate();

    /**
     * Fetch user's Steam library
     */
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

    /**
     * Fetch basic Steam user stats
     */
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

    /**
     * Fetch extended user statistics (lazy loaded)
     */
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

    /**
     * Fetch stats for a specific game (with caching)
     */
    const fetchGameSpecificStats = (appid) => {
        // Return cached data if available
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

                // Cache result for future use
                setGameStatsCache(prev => ({ ...prev, [appid]: data }));
            })
            .catch(err => {
                console.error(err);
                setShowOverlayId(null);
            })
            .finally(() => setStatsLoadingGame(false));
    };

    /**
     * Toggle expanded stats panel
     * Lazy loads extended stats if not already fetched
     */
    const toggleExpandedStats = () => {
        const next = !showExpanded;
        setShowExpanded(next);

        if (next && !extendedStats) {
            fetchExtendedUserStats();
        }
    };

    /**
     * Initial data load when user changes
     */
    useEffect(() => {
        if (user) {
            fetchLibrary();
            fetchUserStats();
        } else {
            setGames([]);
        }
    }, [user]);

    // Loading state UI
    if (loading) {
        return (
            <div className="home-container">
                <div className="login-content" style={{ margin: 'auto' }}>
                    <p>Loading...</p>
                </div>
            </div>
        );
    }

    // Not logged-in UI
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

    // Main dashboard UI
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