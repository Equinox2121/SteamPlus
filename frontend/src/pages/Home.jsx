import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from "react-router-dom";
import { useAuth } from '../context/AuthContext';
import settings from '../settings';
import { prefetchGame, prefetchSimilar, prefetchDeals, getCachedDeals, preloadImage, fetchReviewSummaries } from '../utils/prefetch';
import ReviewBadge from '../components/ReviewBadge';
import Loader from '../components/Loader';
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
    const [genreFilter, setGenreFilter] = useState('all');
    const [searchInput, setSearchInput] = useState('');
    const [salesData, setSalesData] = useState({});
    const [reviewSummaries, setReviewSummaries] = useState({});

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

    const submitSearch = (e) => {
        e.preventDefault();
        const q = searchInput.trim();
        if (q.length >= 2) navigate(`/search?q=${encodeURIComponent(q)}`);
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

    useEffect(() => {
        if (!topGames || topGames.length === 0) return;
        const visible = topGames.slice(0, 12);
        const ids = visible.map((g) => Number(g.appid ?? g.app_id)).filter((n) => Number.isFinite(n));
        const titles = visible.map((g) => g.name || '');
        if (ids.length === 0) return;
        let cancelled = false;
        const url = `${import.meta.env.VITE_BACKEND_URL}/deals/by-steam-app-ids?ids=${ids.join(',')}&titles=${encodeURIComponent(titles.join('|'))}`;
        fetch(url, { credentials: 'include' })
            .then((r) => (r.ok ? r.json() : null))
            .then((data) => {
                if (!cancelled && data?.deals) setSalesData(data.deals);
            })
            .catch(() => {});
        return () => { cancelled = true; };
    }, [topGames]);

    useEffect(() => {
        const ids = [
            ...recommendations.map((g) => Number(g.appid ?? g.app_id)),
            ...topGames.map((g) => Number(g.appid ?? g.app_id)),
        ].filter((n) => Number.isFinite(n));
        if (ids.length === 0) return;
        let cancelled = false;
        fetchReviewSummaries(ids).then((map) => {
            if (!cancelled) setReviewSummaries((prev) => ({ ...prev, ...map }));
        });
        return () => { cancelled = true; };
    }, [recommendations, topGames]);

    const featuredPick = recommendations[0] || null;
    const modelVersion = recommendationMeta?.algorithm || 'steam-owned-v3.0';
    const generatedAt = recommendationMeta?.generatedAt
        ? new Date(recommendationMeta.generatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : null;

    const availableGenres = useMemo(() => {
        const set = new Set();
        recommendations.forEach((g) => (g.tags || []).forEach((t) => set.add(t)));
        return Array.from(set).slice(0, 8);
    }, [recommendations]);

    const filteredRecs = useMemo(() => {
        if (genreFilter === 'all') return recommendations;
        return recommendations.filter((g) => (g.tags || []).includes(genreFilter));
    }, [recommendations, genreFilter]);

    const dealItems = useMemo(() => {
        return topGames
            .map((g) => {
                const id = Number(g.appid ?? g.app_id);
                const deal = salesData[id] || salesData[String(id)];
                if (!deal || !deal.available || !Array.isArray(deal.offers)) return null;
                const standard = deal.offers.filter((o) => /standard/i.test(o.edition?.name || ''));
                const pool = standard.length > 0 ? standard : deal.offers;
                const cheapestKeyshop = pool.filter((o) => !o.isOfficial).sort((a, b) => a.price - b.price)[0];
                const cheapestOfficial = pool.filter((o) => o.isOfficial).sort((a, b) => a.price - b.price)[0];
                const best = cheapestKeyshop || cheapestOfficial;
                if (!best || !(best.discountPercent > 0)) return null;
                return {
                    ...g,
                    _bestDiscount: best.discountPercent,
                    _bestPrice: best.price,
                    _bestMerchant: best.merchantName,
                    _bestUrl: best.url,
                    _officialPrice: cheapestOfficial?.price,
                    _ksPrice: cheapestKeyshop?.price,
                    _currency: deal.currency,
                };
            })
            .filter(Boolean)
            .sort((a, b) => b._bestDiscount - a._bestDiscount)
            .slice(0, 8);
    }, [topGames, salesData]);

    const handleHoverPrefetch = (game) => {
        const id = getAppId(game);
        if (!Number.isFinite(id)) return;
        prefetchGame(id);
        prefetchSimilar(id);
        prefetchDeals(id, game.name);
        preloadImage(resolveHeaderImage(game));
    };

    const renderGameCard = (game, options = {}) => {
        const { compact = false, eager = false } = options;
        return (
            <div
                key={game.appid || game.app_id}
                className="store-rec-card"
                onClick={() => openGamePage(game)}
                onMouseEnter={() => handleHoverPrefetch(game)}
                onFocus={() => handleHoverPrefetch(game)}
            >
                <div className="game-image-container">
                    <img
                        src={resolveHeaderImage(game)}
                        alt={game.name}
                        className="game-image"
                        loading={eager ? 'eager' : 'lazy'}
                        decoding="async"
                        fetchpriority={eager ? 'high' : 'auto'}
                    />
                </div>
                <div className="store-rec-body">
                    <div className="store-rec-title">{game.name}</div>
                    {(() => {
                        const id = getAppId(game);
                        const summary = reviewSummaries[id] || reviewSummaries[String(id)];
                        return summary ? (
                            <div style={{ marginBottom: 6 }}>
                                <ReviewBadge summary={summary} compact={compact} />
                            </div>
                        ) : null;
                    })()}
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
                    {games.map((game, idx) => renderGameCard(game, { eager: idx < 4 }))}
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
                            <form className="store-hero-search" onSubmit={submitSearch}>
                                <input
                                    type="text"
                                    placeholder="Search the Steam catalog..."
                                    value={searchInput}
                                    onChange={(e) => setSearchInput(e.target.value)}
                                    className="store-hero-search-input"
                                    aria-label="Search Steam"
                                />
                                <button type="submit" className="store-hero-search-btn">Search</button>
                            </form>
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
                            <div
                                className="store-featured-card"
                                onClick={() => openGamePage(featuredPick)}
                                onMouseEnter={() => handleHoverPrefetch(featuredPick)}
                            >
                                <img
                                    src={resolveHeaderImage(featuredPick)}
                                    alt={featuredPick.name}
                                    className="store-featured-image"
                                    loading="eager"
                                    decoding="async"
                                    fetchpriority="high"
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
                            <div className="store-message-card"><Loader variant="cards" count={6} /></div>
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
                            {availableGenres.length > 0 && (
                                <div className="store-filter-chips">
                                    <button
                                        className={`store-filter-chip ${genreFilter === 'all' ? 'active' : ''}`}
                                        onClick={() => setGenreFilter('all')}
                                    >
                                        All
                                    </button>
                                    {availableGenres.map((g) => (
                                        <button
                                            key={g}
                                            className={`store-filter-chip ${genreFilter === g ? 'active' : ''}`}
                                            onClick={() => setGenreFilter(g)}
                                        >
                                            {g}
                                        </button>
                                    ))}
                                </div>
                            )}
                            <div className="store-grid">
                                {filteredRecs.slice(0, 12).map((game, idx) => renderGameCard(game, { eager: idx < 4 }))}
                            </div>
                            {filteredRecs.length === 0 && (
                                <div className="store-message-card"><p>No matches for that filter.</p></div>
                            )}
                        </section>
                    )}

                    {dealItems.length > 0 && (
                        <section className="store-section-block">
                            <div className="store-section-header">
                                <h3>On Sale Now</h3>
                                <span className="store-section-caption">Steepest discounts via gg.deals</span>
                            </div>
                            <div className="store-grid compact-grid">
                                {dealItems.map((game, idx) => (
                                    <div
                                        key={`sale_${getAppId(game)}`}
                                        className="store-rec-card store-sale-card"
                                        onClick={() => openGamePage(game)}
                                        onMouseEnter={() => handleHoverPrefetch(game)}
                                    >
                                        <div className="game-image-container">
                                            <img
                                                src={resolveHeaderImage(game)}
                                                alt={game.name}
                                                className="game-image"
                                                loading={idx < 4 ? 'eager' : 'lazy'}
                                                decoding="async"
                                            />
                                            <span className="store-sale-badge">-{game._bestDiscount}%</span>
                                        </div>
                                        <div className="store-rec-body">
                                            <div className="store-rec-title">{game.name}</div>
                                            <div className="store-rec-meta-row">
                                                {Number.isFinite(game._officialPrice) && (
                                                    <span>Official ${game._officialPrice.toFixed(2)}</span>
                                                )}
                                                {Number.isFinite(game._ksPrice) && (
                                                    <span>Keys ${game._ksPrice.toFixed(2)}</span>
                                                )}
                                            </div>
                                            <div className="store-rec-footer">View details →</div>
                                        </div>
                                    </div>
                                ))}
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
                            <div className="store-message-card"><Loader variant="cards" count={6} /></div>
                        ) : topGames.length === 0 ? (
                            <div className="store-message-card"><p>Top games are unavailable right now.</p></div>
                        ) : (
                            <div className="store-grid compact-grid">
                                {topGames.slice(0, 8).map((game, idx) => renderGameCard(game, { compact: true, eager: idx < 4 }))}
                            </div>
                        )}
                    </section>
        </div>
    );
}

export default Home;
