import React, { useEffect, useState } from 'react';
import { useNavigate } from "react-router-dom";
import { useAuth } from '../context/AuthContext';
import noAvatar from '../assets/NoAvatar.png';
import './Store.css';

function Profile() {
    const { user, loading, logout } = useAuth();
    const [games, setGames] = useState([]);
    const [gamesLoading, setGamesLoading] = useState(false);
    const [gamesError, setGamesError] = useState("");



    const [stats, setStats] = useState({ recentPlaytime: 0, activeGames: 0 });
    const [achievementsList, setAchievementsList] = useState([]);
    const [statsLoading, setStatsLoading] = useState(false);

    const [activeGameStats, setActiveGameStats] = useState(null); // Stores stats for the "clicked" game
    const [showOverlayId, setShowOverlayId] = useState(null); // Which appid modal is open

    
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


    const fetchGameSpecificStats = (appid) => {
    // Show the overlay for this specific game card
    setShowOverlayId(appid);
    setActiveGameStats(null); // Clear old stats while loading new ones

    fetch(`${import.meta.env.VITE_BACKEND_URL}/steam/game-stats/${appid}`, { 
        credentials: 'include' 
    })
        .then(res => res.json())
        .then(data => {
            setActiveGameStats(data);
        })
        .catch(err => {
            console.error("Failed to fetch specific game stats:", err);
            setShowOverlayId(null); // Close overlay on error
        });
};


    const fetchGlobalStats = () => {
        setStatsLoading(true);
        fetch(`${import.meta.env.VITE_BACKEND_URL}/steam/user-stats`, { credentials: 'include' })
            .then(res => res.json())
            .then(data => {
                // Mapping the backend data to your local state
                setStats({
                    recentPlaytime: data.recentPlaytimeHrs || 0,
                    activeGames: data.recentGamesCount || 0
                });
                setAchievementsList(data.games || []);
            })
            .catch(err => console.error("Stats fetch failed:", err))
            .finally(() => setStatsLoading(false));
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




                    {/* --- USER STATS DASHBOARD --- */}
{user && !statsLoading && (
    <div className="stats-dashboard" style={{ 
    display: 'flex', 
    gap: '30px', 
    marginBottom: '30px', 
    padding: '20px', 
    background: 'rgba(23, 26, 33, 0.8)', 
    borderRadius: '4px',
    borderLeft: '4px solid #66c0f4'
}}>
    <div>
        <span style={{ display: 'block', color: '#8f98a0', fontSize: '11px', textTransform: 'uppercase' }}>Recent Playtime</span>
        <span style={{ fontSize: '24px', color: '#ffffff', fontWeight: 'bold' }}>{stats.recentPlaytime} hrs</span>
        <span style={{ color: '#8f98a0', fontSize: '12px', marginLeft: '5px' }}>last 2 weeks</span>
    </div>
    <div style={{ borderLeft: '1px solid #333', paddingLeft: '30px' }}>
        <span style={{ display: 'block', color: '#8f98a0', fontSize: '11px', textTransform: 'uppercase' }}>Library Size</span>
        <span style={{ fontSize: '24px', color: '#ffffff', fontWeight: 'bold' }}>{games.length}</span>
        <span style={{ color: '#8f98a0', fontSize: '12px', marginLeft: '5px' }}>total games</span>
    </div>
    <div style={{ borderLeft: '1px solid #333', paddingLeft: '30px' }}>
        <span style={{ display: 'block', color: '#8f98a0', fontSize: '11px', textTransform: 'uppercase' }}>Active Games</span>
        <span style={{ fontSize: '24px', color: '#ffffff', fontWeight: 'bold' }}>{stats.activeGames}</span>
        <span style={{ color: '#8f98a0', fontSize: '12px', marginLeft: '5px' }}>recently</span>
    </div>
</div>
)}


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
                                <div key={game.appid} className="game-card" style={{ position: 'relative' }}>
    <div className="game-image-container" onClick={() => navigate(`/game/${game.appid}`)}>
        <img src={game.header_image} alt={game.name} className="game-image" />
    </div>
    
    {/* Little Chart Button */}
    <button 
        className="stats-icon-btn"
        onClick={(e) => {
            e.stopPropagation();
            fetchGameSpecificStats(game.appid);
        }}
        style={{
            position: 'absolute',
            bottom: '45px',
            right: '10px',
            background: 'rgba(0,0,0,0.7)',
            border: '1px solid #66c0f4',
            borderRadius: '4px',
            cursor: 'pointer',
            padding: '4px'
        }}
    >
        📊
    </button>

    <div className="game-info">
        <div style={{ fontWeight: '500', color: '#ffffff' }}>{game.name}</div>
    </div>

    {/* Small Stats Popover */}
    {showOverlayId === game.appid && (
        <div className="mini-stats-popover" style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            background: 'rgba(23, 26, 33, 0.95)',
            zIndex: 10,
            padding: '10px',
            fontSize: '12px'
        }}>
            <button onClick={() => setShowOverlayId(null)} style={{float:'right'}}>X</button>
            <h4 style={{color: '#66c0f4'}}>Stats</h4>
            {activeGameStats ? (
                <div>
                    <p>Achievements: {activeGameStats.unlocked} / {activeGameStats.total}</p>
                    <div style={{ width: '100%', bg: '#333', height: '5px' }}>
                        <div style={{ width: `${activeGameStats.percentage}%`, bg: '#66c0f4', height: '100%' }} />
                    </div>
                </div>
            ) : <p>Loading...</p>}
        </div>
    )}
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