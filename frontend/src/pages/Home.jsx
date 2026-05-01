import React, { useEffect, useState } from 'react';
import { useNavigate } from "react-router-dom";
import { useAuth } from '../context/AuthContext';
import settings from '../settings';
import './Store.css';

function Home() {
    const { user, loading } = useAuth();
    const navigate = useNavigate();
    const [categories, setCategories] = useState(null);
    const [recommendations, setRecommendations] = useState([]);
    const [recommendationMeta, setRecommendationMeta] = useState(null);
    const [topGames, setTopGames] = useState([]);
    const [recsLoading, setRecsLoading] = useState(false);
    const [topGamesLoading, setTopGamesLoading] = useState(false);
    const [recsError, setRecsError] = useState("");

    const getAppId = (game) => Number(game?.appid ?? game?.app_id);

    const resolveHeaderImage = (game) => {
        const appid = getAppId(game);
        if (game?.header_image) return game.header_image;
        if (Number.isFinite(appid)) {
            return `https://cdn.cloudflare.steamstatic.com/steam/apps/${appid}/header.jpg`;
        }
        return '';
    };

    const openGamePage = (game) => {
        const appid = getAppId(game);
        if (Number.isFinite(appid)) {
            navigate(`/game/${appid}`);
        }
    };

    const toPercent = (value) => {
        const numeric = Number(value);
        if (!Number.isFinite(numeric)) return 0;
        return Math.max(0, Math.round(numeric));
    };

    const getSignalEntries = (signals) => {
        if (!signals || typeof signals !== 'object') return [];
        return Object.entries(signals)
            .filter(([, score]) => Number.isFinite(Number(score)))
            .slice(0, 4);
    };

    const jumpToTrending = () => {
        const el = document.getElementById('store-trending-section');
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    useEffect(() => {
        let isMounted = true;

        const fetchTopGames = async () => {
            setTopGamesLoading(true);
            try {
                const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/steam/top-games?limit=12`);
                if (!response.ok) throw new Error('failed to load top games');
                const data = await response.json();
                if (isMounted) setTopGames(Array.isArray(data.games) ? data.games : []);
            } catch (error) {
                console.error(error);
                if (isMounted) setTopGames([]);
            } finally {
                if (isMounted) setTopGamesLoading(false);
            }
        };

        const fetchOwnedRecommendations = async () => {
            if (!user) {
                setRecommendations([]);
                setCategories(null);
                setRecommendationMeta(null);
                setRecsError('');
                return;
            }

            setRecsLoading(true);
            setRecsError("");

            try {
                const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/steam/recommendations/owned?limit=18`, {
                    credentials: 'include'
                });
                if (!response.ok) throw new Error('failed to load store recommendations');
                const data = await response.json();
                if (isMounted) {
                    setRecommendations(Array.isArray(data.recommendations) ? data.recommendations : []);
                    setCategories(data.categories || null);
                    setRecommendationMeta(data.meta || null);
                }
            } catch (error) {
                console.error(error);
                if (isMounted) {
                    setRecommendations([]);
                    setCategories(null);
                    setRecommendationMeta(null);
                    setRecsError('Could not load personalized recommendations right now.');
                }
            } finally {
                if (isMounted) setRecsLoading(false);
            }
        };

        fetchTopGames();
        fetchOwnedRecommendations();
        return () => { isMounted = false; };
    }, [user]);

    const featuredPick = recommendations[0] || null;
    const modelVersion = recommendationMeta?.algorithm || 'steam-owned-v3.0';
    const generatedAt = recommendationMeta?.generatedAt
        ? new Date(recommendationMeta.generatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : null;

    const renderGameCard = (game, options = {}) => {
        const { compact = false } = options;
        return (
            <div
                key={game.appid || game.app_id}
                className="store-rec-card"
                onClick={() => openGamePage(game)}
            >
                <div className="game-image-container">
                    <img src={resolveHeaderImage(game)} alt={game.name} className="game-image" />
                </div>
                <div className="store-rec-body">
                    <div className="store-rec-title">{game.name}</div>
                    {settings.developer && !compact && game.relevance != null && (
                        <div className="store-rec-meta-row">
                            <span>Match {toPercent(game.relevance)}%</span>
                            <span>{toPercent(game.confidence)}% confidence</span>
                        </div>
                    )}
                    {!compact && game.reason && (
                        <div className="store-rec-reason">{game.reason}</div>
                    )}
                    {settings.developer && !compact && game.relevance != null && (
                        <div className="store-rec-score-track">
                            <span style={{ width: `${toPercent(game.relevance)}%` }} />
                        </div>
                    )}
                    {settings.developer && !compact && getSignalEntries(game.signals).length > 0 && (
                        <div className="store-signal-row">
                            {getSignalEntries(game.signals).slice(0, 2).map(([signal, score]) => (
                                <span key={`${getAppId(game)}_${signal}`} className="store-signal-chip compact">
                                    {signal} {toPercent(score)}%
                                </span>
                            ))}
                        </div>
                    )}
                    {(game.tags || []).length > 0 && (
                        <div className="store-tags-row">
                            {game.tags.slice(0, 3).map((tag) => (
                                <span key={`${getAppId(game)}_${tag}`} className="store-tag">{tag}</span>
                            ))}
                        </div>
                    )}
                    {compact && game.score_rank && (
                        <div className="store-rec-meta-row">
                            <span>Rank #{game.score_rank}</span>
                            <span>Top chart</span>
                        </div>
                    )}
                    <div className="store-rec-footer">View details →</div>
                </div>
            </div>
        );
    };

    const renderCategoryRow = (title, caption, games) => {
        if (!games || games.length === 0) return null;
        return (
            <section className="store-section-block store-category-section">
                <div className="store-section-header">
                    <h3>{title}</h3>
                    <span className="store-section-caption">{caption}</span>
                </div>
                <div className="store-grid compact-grid">
                    {games.map((game) => renderGameCard(game))}
                </div>
            </section>
        );
    };

    const hasCategoryData = categories && (
        (categories.topPicks?.length > 0) ||
        (categories.becauseYouPlay?.length > 0) ||
        (categories.trending?.length > 0) ||
        (categories.deepDives?.length > 0) ||
        (categories.discoveries?.length > 0)
    );

    return (
        <div className="home-container store-home-container">
            {loading ? (
                <div className="login-content store-loading-panel">
                    <p>Loading...</p>
                </div>
            ) : (
                <>
                    <div className="header-section store-hero-header">
                        <div className="store-hero-copy">
                            <div className="store-kicker">Steam Store</div>
                            <h2 className="store-page-title">Discover your next favorite game</h2>
                            <p className="store-page-subtitle">
                                View personalized recommendations based on your previous interests.
                            </p>
                            {user && settings.developer && (
                                <div className="store-model-chip-row">
                                    <span className="store-model-chip">{modelVersion}</span>
                                    {generatedAt && <span className="store-model-chip">Updated {generatedAt}</span>}
                                    {recommendationMeta?.seed && <span className="store-model-chip">Seed {recommendationMeta.seed}</span>}
                                </div>
                            )}
                        </div>
                        <div className="store-hero-actions">
                            <button type="button" className="secondary-btn store-hero-btn" onClick={jumpToTrending}>
                                Browse trending
                            </button>
                        </div>
                    </div>

                    {/* featured pick */}
                    {user && !recsLoading && !recsError && featuredPick && (
                        <section className="store-section-block">
                            <div className="store-section-header">
                                <h3>Featured For You</h3>
                                <span className="store-section-caption">Top pick from your library profile</span>
                            </div>
                            <div className="store-featured-card" onClick={() => openGamePage(featuredPick)}>
                                <img
                                    src={resolveHeaderImage(featuredPick)}
                                    alt={featuredPick.name}
                                    className="store-featured-image"
                                />
                                <div className="store-featured-overlay">
                                    <div className="store-featured-label">Top pick for you</div>
                                    <h4>{featuredPick.name}</h4>
                                    <p>{featuredPick.reason || 'Matched from your owned-game profile'}</p>
                                    {settings.developer && (
                                        <div className="store-featured-metrics">
                                            <span className="store-metric-pill">Match {toPercent(featuredPick.relevance)}%</span>
                                            <span className="store-metric-pill">Confidence {toPercent(featuredPick.confidence)}%</span>
                                        </div>
                                    )}
                                    {settings.developer && getSignalEntries(featuredPick.signals).length > 0 && (
                                        <div className="store-signal-row">
                                            {getSignalEntries(featuredPick.signals).map(([signal, score]) => (
                                                <span key={`featured_${signal}`} className="store-signal-chip">
                                                    {signal}: {toPercent(score)}%
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                    <div className="store-featured-cta">View game details →</div>
                                </div>
                            </div>
                        </section>
                    )}

                    {/* sign-in / loading / error states */}
                    {!user && (
                        <section className="store-section-block">
                            <div className="store-message-card">
                                <p>Sign in with Steam to unlock personalized recommendations based on your owned games and playtime patterns.</p>
                            </div>
                        </section>
                    )}
                    {user && recsLoading && (
                        <section className="store-section-block">
                            <div className="store-message-card"><p>Loading personalized recommendations...</p></div>
                        </section>
                    )}
                    {user && recsError && (
                        <section className="store-section-block">
                            <div className="store-message-card store-error-card"><p>{recsError}</p></div>
                        </section>
                    )}

                    {/* Steam-style category sections */}
                    {user && !recsLoading && !recsError && hasCategoryData && (
                        <>
                            {renderCategoryRow(
                                "Because You Play",
                                "Games matching your most-played genres",
                                categories.becauseYouPlay
                            )}
                            {renderCategoryRow(
                                "Trending Now",
                                "Rising fast among Steam players this week",
                                categories.trending
                            )}
                            {renderCategoryRow(
                                "Deep Dives",
                                "Games players spend long sessions in",
                                categories.deepDives
                            )}
                            {renderCategoryRow(
                                "New Discoveries",
                                "Fresh picks outside your usual genres",
                                categories.discoveries
                            )}
                            {renderCategoryRow(
                                "Top Picks",
                                "Best overall matches for your taste",
                                categories.topPicks
                            )}
                        </>
                    )}

                    {/* fallback flat grid when no categories */}
                    {user && !recsLoading && !recsError && !hasCategoryData && recommendations.length > 0 && (
                        <section className="store-section-block">
                            <div className="store-section-header">
                                <h3>Recommended For You</h3>
                                <span className="store-section-caption">Based on your owned library</span>
                            </div>
                            <div className="store-grid">
                                {recommendations.slice(0, 12).map((game) => renderGameCard(game))}
                            </div>
                        </section>
                    )}

                    {/* trending section */}
                    <section className="store-section-block" id="store-trending-section">
                        <div className="store-section-header">
                            <h3>Trending on Steam</h3>
                            <span className="store-section-caption">From preloaded top games</span>
                        </div>
                        {topGamesLoading ? (
                            <div className="store-message-card"><p>Loading trending games...</p></div>
                        ) : topGames.length === 0 ? (
                            <div className="store-message-card"><p>Top games are unavailable right now.</p></div>
                        ) : (
                            <div className="store-grid compact-grid">
                                {topGames.slice(0, 8).map((game) => renderGameCard(game, { compact: true }))}
                            </div>
                        )}
                    </section>
                </>
            )}
        </div>
    );
}

export default Home;
