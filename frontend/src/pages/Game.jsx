import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import './Game.css';

const Game = () => {
    const { appid } = useParams();
    const [gameData, setGameData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const navigate = useNavigate();

    useEffect(() => {
        const fetchGameDetails = async () => {
            try {
                const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/steam/game/${appid}`);
                if (!response.ok) {
                    throw new Error('Failed to fetch game details');
                }
                const data = await response.json();
                setGameData(data);
            } catch (err) {
                console.error(err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchGameDetails();
    }, [appid]);

    if (loading) return <div className="game-page-loading">Loading game details...</div>;
    if (error) return <div className="game-page-error">Error: {error}</div>;
    if (!gameData) return <div className="game-page-error">Game not found.</div>;

    const { name, short_description, header_image, screenshots, price_overview, steam_appid } = gameData;
    const price = price_overview ? price_overview.final_formatted : 'Free to Play';

    return (
        <div className="game-page-container">
            <div className="game-page-header">
                <h1>{name}</h1>
                <button className="back-btn" onClick={() => navigate(-1)}>Back</button>
            </div>

            <div className="game-page-content">
                <div className="game-main-info">
                    <div className="game-image-gallery">
                        <img src={header_image} alt={name} className="main-header-image" />
                        <div className="screenshots-grid">
                            {screenshots && screenshots.slice(0, 4).map((s) => (
                                <img key={s.id} src={s.path_thumbnail} alt="screenshot" className="screenshot-item" />
                            ))}
                        </div>
                    </div>

                    <div className="game-sidebar">
                        <img src={header_image} alt={name} className="sidebar-header-image" />
                        <div className="game-description" dangerouslySetInnerHTML={{ __html: short_description }} />
                        
                        <div className="game-purchase-section">
                            <div className="price-tag">{price}</div>
                            <a 
                                href={`https://store.steampowered.com/app/${steam_appid}`} 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                className="visit-steam-btn"
                            >
                                Visit Steam Page
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Game;
