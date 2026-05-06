import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { prefetchGame, prefetchSimilar, getCachedGame, getCachedSimilar, prefetchDeals, preloadImage, fetchReviewSummaries } from '../utils/prefetch';
import DealsWidget from '../components/DealsWidget';
import ReviewSection from '../components/ReviewSection';
import ReviewBadge from '../components/ReviewBadge';
import Loader from '../components/Loader';
import './Game.css';
import './Store.css';

const SAVED_KEY = 'sp_saved_games';

const readSaved = () => {
    try { return JSON.parse(localStorage.getItem(SAVED_KEY) || '[]'); } catch { return []; }
};

const isSaved = (appid) => readSaved().includes(Number(appid));

const toggleSaved = (appid) => {
    const id = Number(appid);
    const list = readSaved();
    const next = list.includes(id) ? list.filter((n) => n !== id) : [...list, id];
    localStorage.setItem(SAVED_KEY, JSON.stringify(next));
    return next.includes(id);
};

const Game = () => {
    const { appid } = useParams();
    const cachedGame = getCachedGame(appid);
    const cachedSimilar = getCachedSimilar(appid);
    const [gameData, setGameData] = useState(cachedGame);
    const [recommendations, setRecommendations] = useState(cachedSimilar?.recommendations || []);
    const [loading, setLoading] = useState(!cachedGame);
    const [recsLoading, setRecsLoading] = useState(!cachedSimilar);
    const [error, setError] = useState(null);
    const [activeTab, setActiveTab] = useState('overview');
    const [activeScreenshot, setActiveScreenshot] = useState(null);
    const [saved, setSaved] = useState(isSaved(appid));
    const [reviewSummary, setReviewSummary] = useState(null);
    const navigate = useNavigate();

    useEffect(() => {
        let active = true;
        setSaved(isSaved(appid));
        setActiveTab('overview');

        prefetchGame(appid).then((data) => {
            if (!active) return;
            if (data) {
                setGameData(data);
                setError(null);
            } else if (!cachedGame) {
                setError('Failed to fetch game details');
            }
            setLoading(false);
        });

        prefetchSimilar(appid).then((data) => {
            if (!active) return;
            if (data) setRecommendations(data.recommendations || []);
            setRecsLoading(false);
        });

        fetchReviewSummaries([Number(appid)]).then((map) => {
            if (active) setReviewSummary(map[Number(appid)] || null);
        });

        return () => { active = false; };
    }, [appid]);

    useEffect(() => {
        if (recommendations && recommendations.length > 0) {
            recommendations.slice(0, 4).forEach((rec) => preloadImage(rec.header_image));
        }
    }, [recommendations]);

    useEffect(() => {
        if (gameData?.name) prefetchDeals(appid, gameData.name);
    }, [appid, gameData?.name]);

    const handleSaveToggle = () => setSaved(toggleSaved(appid));

    const tags = useMemo(() => {
        if (!gameData) return [];
        if (gameData.user_tags && gameData.user_tags.length > 0) return gameData.user_tags;
        return [
            ...(gameData.genres || []).map((g) => g.description),
            ...(gameData.categories || []).map((c) => c.description),
        ];
    }, [gameData]);

    if (loading) return <div className="game-page-loading"><Loader variant="page" /></div>;
    if (error) return <div className="game-page-error">Error: {error}</div>;
    if (!gameData) return <div className="game-page-error">Game not found.</div>;

    const {
        name,
        short_description,
        header_image,
        screenshots,
        price_overview,
        steam_appid,
        release_date,
        developers,
        publishers,
        metacritic,
    } = gameData;

    const price = price_overview ? price_overview.final_formatted : 'Free to Play';
    const onSalePct = price_overview && price_overview.discount_percent > 0 ? price_overview.discount_percent : null;
    const releaseString = release_date?.coming_soon ? 'Coming soon' : (release_date?.date || 'Unknown release');

    const renderOverview = () => (
        <>
            {reviewSummary && reviewSummary.total > 0 && (
                <div className="store-overview-reviews">
                    <ReviewBadge summary={reviewSummary} />
                    <span className="store-overview-reviews-label">{reviewSummary.label}</span>
                    <span className="store-overview-reviews-stats">
                        {reviewSummary.positivePercent != null ? `${reviewSummary.positivePercent}% of ${reviewSummary.total} SteamPlus users recommend this game.` : `${reviewSummary.total} reviews`}
                    </span>
                    <button type="button" className="reviews-btn-secondary" onClick={() => setActiveTab('reviews')}>
                        Read user reviews
                    </button>
                </div>
            )}
            <div className="game-main-info">
                <div className="game-image-gallery">
                    <img
                        src={header_image}
                        alt={name}
                        className="main-header-image"
                        loading="eager"
                        decoding="async"
                        fetchpriority="high"
                    />
                    {screenshots && screenshots.length > 0 && (
                        <div className="screenshots-grid">
                            {screenshots.slice(0, 6).map((s, idx) => (
                                <img
                                    key={s.id}
                                    src={s.path_thumbnail}
                                    alt="screenshot"
                                    className="screenshot-item"
                                    loading={idx < 2 ? 'eager' : 'lazy'}
                                    decoding="async"
                                    onClick={() => setActiveScreenshot(s.path_full || s.path_thumbnail)}
                                />
                            ))}
                        </div>
                    )}
                </div>

                <div className="game-sidebar">
                    <img
                        src={header_image}
                        alt={name}
                        className="sidebar-header-image"
                        loading="lazy"
                        decoding="async"
                    />
                    <div className="game-description" dangerouslySetInnerHTML={{ __html: short_description }} />

                    <div className="game-meta-list">
                        <div className="game-meta-row"><span>Released</span><span>{releaseString}</span></div>
                        {developers?.length > 0 && (
                            <div className="game-meta-row"><span>Developer</span><span>{developers.join(', ')}</span></div>
                        )}
                        {publishers?.length > 0 && (
                            <div className="game-meta-row"><span>Publisher</span><span>{publishers.join(', ')}</span></div>
                        )}
                        {metacritic?.score && (
                            <div className="game-meta-row"><span>Metacritic</span><span>{metacritic.score}</span></div>
                        )}
                    </div>

                    {tags.length > 0 && (
                        <div className="game-genres">
                            {tags.slice(0, 12).map((tag, index) => (
                                <span key={index} className="genre-tag">{tag}</span>
                            ))}
                        </div>
                    )}

                    <div className="game-purchase-section">
                        <div className="price-tag-row">
                            <div className="price-tag">{price}</div>
                            {onSalePct && <span className="price-discount">-{onSalePct}%</span>}
                        </div>
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

            <DealsWidget appid={Number(appid)} gameName={name} />
        </>
    );

    const renderDeals = () => (
        <div className="game-tab-deals">
            <DealsWidget appid={Number(appid)} gameName={name} />
        </div>
    );

    const refreshReviewSummary = () => {
        fetchReviewSummaries([Number(appid)]).then((map) => {
            setReviewSummary(map[Number(appid)] || null);
        });
    };

    const renderReviews = () => <ReviewSection appid={Number(appid)} onChange={refreshReviewSummary} />;

    const renderSimilar = () => (
        <div className="recommendations-section">
            {recsLoading ? (
                <div className="recs-loading"><Loader variant="cards" count={6} /></div>
            ) : recommendations.length > 0 ? (
                <div className="recommendations-grid">
                    {recommendations.map((rec, idx) => (
                        <div
                            key={rec.appid}
                            className="rec-card"
                            onClick={() => navigate(`/game/${rec.appid}`)}
                            onMouseEnter={() => { prefetchGame(rec.appid); prefetchSimilar(rec.appid); prefetchDeals(rec.appid, rec.name); preloadImage(rec.header_image); }}
                            onFocus={() => { prefetchGame(rec.appid); prefetchSimilar(rec.appid); }}
                        >
                            <img
                                src={rec.header_image}
                                alt={rec.name}
                                className="rec-image"
                                loading={idx < 4 ? 'eager' : 'lazy'}
                                decoding="async"
                            />
                            <div className="rec-info">
                                <div className="rec-name">{rec.name}</div>
                                <div className="rec-genres">
                                    {(rec.tags || rec.genres || []).slice(0, 3).map((g, i) => (
                                        <span key={i} className="rec-genre">{g}</span>
                                    ))}
                                </div>
                                <div className="rec-price">{rec.price}</div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="no-recs">No similar games found.</div>
            )}
        </div>
    );

    return (
        <div className="game-page-container">
            <div className="game-page-header">
                <div className="game-page-title-block">
                    <h1>{name}</h1>
                    <div className="game-page-subtitle">{releaseString}{developers?.length ? ` · ${developers.join(', ')}` : ''}</div>
                </div>
                <div className="game-page-actions">
                    <button className={`save-btn ${saved ? 'saved' : ''}`} onClick={handleSaveToggle}>
                        {saved ? '★ Saved' : '☆ Save'}
                    </button>
                    <button className="back-btn" onClick={() => navigate(-1)}>Back</button>
                </div>
            </div>

            <div className="game-tabs">
                <button className={`game-tab ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}>Overview</button>
                <button className={`game-tab ${activeTab === 'deals' ? 'active' : ''}`} onClick={() => setActiveTab('deals')}>Deals</button>
                <button className={`game-tab ${activeTab === 'reviews' ? 'active' : ''}`} onClick={() => setActiveTab('reviews')}>User Reviews</button>
                <button className={`game-tab ${activeTab === 'similar' ? 'active' : ''}`} onClick={() => setActiveTab('similar')}>Similar Games</button>
            </div>

            <div className="game-tab-content">
                {activeTab === 'overview' && renderOverview()}
                {activeTab === 'deals' && renderDeals()}
                {activeTab === 'reviews' && renderReviews()}
                {activeTab === 'similar' && renderSimilar()}
            </div>

            {activeScreenshot && (
                <div className="screenshot-lightbox" onClick={() => setActiveScreenshot(null)} role="dialog" aria-modal="true">
                    <img src={activeScreenshot} alt="screenshot" />
                </div>
            )}
        </div>
    );
};

export default Game;
