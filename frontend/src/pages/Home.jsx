import React from 'react';
import { useNavigate } from "react-router-dom";
import { useAuth } from '../context/AuthContext';
import './Store.css';

function Home() {
    const { user, loading } = useAuth();
    const navigate = useNavigate();
    //these are all testing games for now
    return (
        <div className="home-container">
            {loading ? (
                <div className="login-content" style={{ margin: 'auto' }}>
                    <p>Loading...</p>
                </div>
            ) : (
                <>
                    <div className="header-section">
                        <h2 style={{ margin: 0 }}>Store Page</h2>
                    </div>
                    
                    <div className="store-content" style={{ marginTop: '40px', color: '#ffffff' }}>
                        <h3>Featured & Recommended</h3>
                        <p>Store content is coming soon!</p>
                        <div style={{ marginTop: '20px', display: 'flex', gap: '20px', justifyContent: 'center', flexWrap: 'wrap' }}>
                            <div 
                                className="game-card" 
                                style={{ width: '200px', height: '100px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#1b2838', cursor: 'pointer' }}
                                onClick={() => navigate('/game/730')}
                            >
                                Counter-Strike 2
                            </div>
                            <div 
                                className="game-card" 
                                style={{ width: '200px', height: '100px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#1b2838', cursor: 'pointer' }}
                                onClick={() => navigate('/game/570')}
                            >
                                Dota 2
                            </div>
                            <div 
                                className="game-card" 
                                style={{ width: '200px', height: '100px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#1b2838', cursor: 'pointer' }}
                                onClick={() => navigate('/game/1091500')}
                            >
                                Cyberpunk 2077
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}

export default Home;