import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { prefetchGame, prefetchSimilar, preloadImage } from '../utils/prefetch';
import Loader from '../components/Loader';
import noAvatar from '../assets/NoAvatar.png';
import './Friends.css';

function Friends() {
    const { user, loading } = useAuth();
    const navigate = useNavigate();
    const [friends, setFriends] = useState([]);
    const [friendsLoading, setFriendsLoading] = useState(false);
    const [friendsError, setFriendsError] = useState('');

    useEffect(() => {
        if (!user) {
            setFriends([]);
            setFriendsError('');
            setFriendsLoading(false);
            return;
        }

        setFriendsLoading(true);
        setFriendsError('');

        fetch(`${import.meta.env.VITE_BACKEND_URL || ''}/steam/friends-activity`, {
            credentials: 'include'
        })
            .then(async (res) => {
                const data = await res.json();
                if (!res.ok) {
                    throw new Error(data.error || 'Could not load friend activity');
                }
                setFriends(Array.isArray(data.friends) ? data.friends : []);
            })
            .catch((err) => {
                console.error('Friend activity load error:', err);
                setFriendsError(err.message || 'Could not load friend activity');
            })
            .finally(() => setFriendsLoading(false));
    }, [user]);

    const recentGames = friends
        .flatMap((friend) =>
            (friend.recentGames || []).map((game) => ({
                ...game,
                friendName: friend.username
            }))
        )
        .slice(0, 10);

    return (
        <div className="home-container">
            {loading ? (
                <Loader variant="page" />
            ) : user ? (
                <>
                    <div className="header-section">
                        <h2 style={{ margin: 0 }}>Friend Activity</h2>
                    </div>

                    <div className="section-title">Live Feed</div>
                    {friendsLoading ? (
                        <Loader variant="cards" count={6} />
                    ) : friendsError ? (
                        <p style={{ color: '#ff4b4b' }}>{friendsError}</p>
                    ) : friends.length === 0 ? (
                        <p>No friend activity available yet.</p>
                    ) : (
                        <div className="library-container" style={{ marginBottom: '24px' }}>
                            {friends.map((friend) => (
                                <div key={friend.steamid} className="game-card" style={{ minHeight: '180px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                                    <div style={{ padding: '14px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                                            <img
                                                src={friend.avatar || noAvatar}
                                                alt={`${friend.username} avatar`}
                                                style={{ width: '48px', height: '48px', borderRadius: '8px', objectFit: 'cover', border: '1px solid rgba(255,255,255,0.1)' }}
                                                onError={(e) => { e.currentTarget.src = noAvatar; }}
                                            />
                                            <div>
                                                <div style={{ fontWeight: '600', color: '#ffffff' }}>{friend.username}</div>
                                                <div style={{ fontSize: '12px', color: '#8f98a0' }}>{friend.status}</div>
                                                {friend.currentGame && (
                                                    <div style={{ fontSize: '12px', color: '#66c0f4' }}>{friend.currentGame}</div>
                                                )}
                                            </div>
                                        </div>
                                        <div style={{ color: '#c6d4df', marginBottom: '12px' }}>
                                            {friend.recentGames?.length > 0
                                                ? `Recently played ${friend.recentGames[0].name} for ${Math.round(friend.recentGames[0].playtime_2weeks / 60)} hrs in the last two weeks`
                                                : 'No recent games public or available.'}
                                        </div>
                                    </div>
                                    {friend.recentGames?.[0] && (
                                        <button
                                            className="steam-btn"
                                            style={{ margin: '0 14px 14px' }}
                                            onClick={() => navigate(`/game/${friend.recentGames[0].appid}`)}
                                        >
                                            View {friend.recentGames[0].name}
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="section-title">Recent Games Your Friends Played</div>
                    {friendsLoading ? (
                        <Loader variant="cards" count={5} />
                    ) : recentGames.length === 0 ? (
                        <p>No recent games available from your friends.</p>
                    ) : (
                        <div className="library-container">
                            {recentGames.map((game, idx) => (
                                <div
                                    key={`${game.appid}-${game.friendName}`}
                                    className="game-card"
                                    onClick={() => navigate(`/game/${game.appid}`)}
                                    onMouseEnter={() => { prefetchGame(game.appid); prefetchSimilar(game.appid); preloadImage(game.header_image); }}
                                    onFocus={() => { prefetchGame(game.appid); prefetchSimilar(game.appid); }}
                                >
                                    <div className="game-image-container">
                                        <img
                                            src={game.header_image}
                                            alt={game.name}
                                            className="game-image"
                                            loading={idx < 4 ? 'eager' : 'lazy'}
                                            decoding="async"
                                            onError={(e) => { e.currentTarget.src = 'https://community.cloudflare.steamstatic.com/public/images/applications/community/unknown_game.jpg'; }}
                                        />
                                    </div>
                                    <div className="game-info">
                                        <div style={{ fontWeight: '500', color: '#ffffff' }}>{game.name}</div>
                                        <div style={{ fontSize: '12px', color: '#8f98a0', marginTop: '6px' }}>
                                            Played by {game.friendName} for {Math.round(game.playtime_2weeks / 60)} hrs
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </>
            ) : (
                <div className="login-content" style={{ margin: '100px auto' }}>
                    <h2>Wait until you log in</h2>
                    <p>You must be signed in to see your friends&apos; activity.</p>
                    <button onClick={() => navigate('/login')} className="steam-btn">Go to Login</button>
                </div>
            )}
        </div>
    );
}

export default Friends;
