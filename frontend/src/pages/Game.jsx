import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import './Game.css';

const Game = () => {
    const { appid } = useParams();
    const [gameData, setGameData] = useState(null);
    const [recommendations, setRecommendations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [recsLoading, setRecsLoading] = useState(true);
    const [error, setError] = useState(null);
    const navigate = useNavigate();

    useEffect(() => {
        const fetchGameDetails = async () => {
            try {
                const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/steam/game/${appid}`);
                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    throw new Error(errorData.error || 'Failed to fetch game details');
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

        const fetchRecommendations = async () => {
            setRecsLoading(true);
            try {
                const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/steam/recommendations/${appid}`);
                if (response.ok) {
                    const data = await response.json();
                    setRecommendations(data.recommendations || []);
                }
            } catch (err) {
                console.error("Failed to fetch recommendations:", err);
            } finally {
                setRecsLoading(false);
            }
        };

        fetchGameDetails();
        fetchRecommendations();
    }, [appid]);

    if (loading) return <div className="game-page-loading">Loading game details...</div>;
    if (error) return <div className="game-page-error">Error: {error}</div>;
    if (!gameData) return <div className="game-page-error">Game not found.</div>;

    const { name, short_description, header_image, screenshots, price_overview, steam_appid, genres, categories, user_tags } = gameData;
    const price = price_overview ? price_overview.final_formatted : 'Free to Play';

    const tags = user_tags || [
        ...(genres || []).map(g => g.description),
        ...(categories || []).map(c => c.description)
    ];

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
                        
                        {tags.length > 0 && (
                            <div className="game-genres">
                                {tags.map((tag, index) => (
                                    <span key={index} className="genre-tag">{tag}</span>
                                ))}
                            </div>
                        )}

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

            <div className="recommendations-section">
                <h2>Similar Games</h2>
                {recsLoading ? (
                    <div className="recs-loading">Finding similar games...</div>
                ) : recommendations.length > 0 ? (
                    <div className="recommendations-grid">
                        {recommendations.map((rec) => (
                            <div 
                                key={rec.appid} 
                                className="rec-card"
                                onClick={() => navigate(`/game/${rec.appid}`)}
                            >
                                <img src={rec.header_image} alt={rec.name} className="rec-image" />
                                <div className="rec-info">
                                    <div className="rec-name">{rec.name}</div>
                                    <div className="rec-genres">
                                        {(rec.tags || rec.genres || []).map((g, i) => (
                                            <span key={i} className="rec-genre">{g}</span>
                                        ))}
                                    </div>
                                    <div className="rec-price">
                                        {rec.price}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="no-recs">No similar games found.</div>
                )}
            </div>
        </div>
    );
};

export default Game;
