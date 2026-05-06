import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Loader from '../components/Loader';
import noAvatar from '../assets/NoAvatar.png';
import './Friends.css';

const CATEGORIES = [
    { key: 'recentHours', label: 'Recent Hours (last 2 weeks)', unit: 'hrs' },
    { key: 'steamLevel', label: 'Steam Level', unit: '' },
    { key: 'ownedCount', label: 'Games Owned', unit: 'games' },
];

const formatVal = (v, unit, key) => {
    const n = Number.isFinite(Number(v)) ? Number(v) : 0;
    if (key === 'ownedCount' && n === 0) {
        return unit ? `??? ${unit}` : '???';
    }
    return unit ? `${n.toLocaleString()} ${unit}` : n.toLocaleString();
};

function Community() {
    const { user, loading } = useAuth();
    const navigate = useNavigate();
    const [data, setData] = useState(null);
    const [boardLoading, setBoardLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!user) {
            setData(null);
            setError('');
            setBoardLoading(false);
            return;
        }
        setBoardLoading(true);
        setError('');
        fetch(`${import.meta.env.VITE_BACKEND_URL || ''}/steam/friends-leaderboard`, { credentials: 'include' })
            .then(async (res) => {
                const j = await res.json();
                if (!res.ok) throw new Error(j.error || 'Could not load leaderboard');
                setData(j);
            })
            .catch((e) => setError(e.message))
            .finally(() => setBoardLoading(false));
    }, [user]);

    if (loading) {
        return <div className="home-container"><Loader variant="page" /></div>;
    }

    if (!user) {
        return (
            <div className="home-container">
                <div className="login-content" style={{ margin: '100px auto' }}>
                    <h2>Sign in to see Community Leaderboards</h2>
                    <p>Compare your Steam stats with friends.</p>
                    <button onClick={() => navigate('/login')} className="steam-btn">Go to Login</button>
                </div>
            </div>
        );
    }

    return (
        <div className="home-container">
            <div className="header-section">
                <h2 style={{ margin: 0 }}>Community Leaderboards</h2>
                {data?.participantCount ? (
                    <div style={{ color: '#8f98a0', fontSize: '13px' }}>
                        Comparing {data.participantCount} player{data.participantCount === 1 ? '' : 's'} (you + friends)
                    </div>
                ) : null}
            </div>

            {boardLoading ? (
                <Loader variant="rows" count={6} />
            ) : error ? (
                <p style={{ color: '#ff4b4b' }}>{error}</p>
            ) : !data ? null : (
                <div style={{ display: 'grid', gap: '24px', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>
                    {CATEGORIES.map((cat) => {
                        const board = data.leaderboards?.[cat.key] || [];
                        return (
                            <div key={cat.key} className="game-card" style={{ padding: '16px' }}>
                                <div className="section-title" style={{ marginTop: 0 }}>{cat.label}</div>
                                <ol style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                                    {board.length === 0 ? (
                                        <li style={{ color: '#8f98a0' }}>No data available.</li>
                                    ) : board.map((row, idx) => (
                                        <li
                                            key={row.steamid}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '12px',
                                                padding: '8px 10px',
                                                borderRadius: '6px',
                                                background: row.isSelf ? 'rgba(102,192,244,0.12)' : 'transparent',
                                                border: row.isSelf ? '1px solid rgba(102,192,244,0.4)' : '1px solid transparent',
                                                marginBottom: '4px',
                                            }}
                                            title={row.private ? 'Profile is private' : undefined}
                                        >
                                            <span style={{ width: '22px', color: '#8f98a0', fontWeight: 600 }}>{idx + 1}</span>
                                            <img
                                                src={row.avatar || noAvatar}
                                                alt=""
                                                style={{ width: '32px', height: '32px', borderRadius: '4px', objectFit: 'cover' }}
                                                onError={(e) => { e.currentTarget.src = noAvatar; }}
                                            />
                                            <span style={{ flex: 1, color: row.isSelf ? '#66c0f4' : '#ffffff', fontWeight: row.isSelf ? 600 : 400 }}>
                                                {row.username}{row.isSelf ? ' (you)' : ''}
                                                {row.private && !row.isSelf ? <span style={{ color: '#8f98a0', fontSize: '11px', marginLeft: '6px' }}>(private)</span> : null}
                                            </span>
                                            <span style={{ color: '#c6d4df' }}>{formatVal(row[cat.key], cat.unit, cat.key)}</span>
                                        </li>
                                    ))}
                                </ol>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

export default Community;
