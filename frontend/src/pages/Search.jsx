import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { searchSteam, prefetchGame, prefetchSimilar, prefetchDeals, preloadImage, fetchReviewSummaries } from '../utils/prefetch';
import ReviewBadge from '../components/ReviewBadge';
import './Search.css';
import '../pages/Store.css';

function Search() {
    const navigate = useNavigate();
    const [params, setParams] = useSearchParams();
    const initialQuery = params.get('q') || '';
    const [query, setQuery] = useState(initialQuery);
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [reviewSummaries, setReviewSummaries] = useState({});

    useEffect(() => {
        const q = (params.get('q') || '').trim();
        setQuery(q);
        if (q.length < 2) {
            setResults([]);
            return;
        }
        setLoading(true);
        setError('');
        const ctrl = new AbortController();
        searchSteam(q, { limit: 24, signal: ctrl.signal })
            .then((data) => setResults(data.results || []))
            .catch((err) => {
                if (err.name !== 'AbortError') setError('Search failed.');
            })
            .finally(() => setLoading(false));
        return () => ctrl.abort();
    }, [params]);

    useEffect(() => {
        if (results.length === 0) return;
        const ids = results.map((r) => Number(r.appid)).filter((n) => Number.isFinite(n));
        let cancelled = false;
        fetchReviewSummaries(ids).then((map) => { if (!cancelled) setReviewSummaries(map); });
        return () => { cancelled = true; };
    }, [results]);

    const submit = (e) => {
        e.preventDefault();
        const q = query.trim();
        if (q.length >= 2) setParams({ q });
    };

    const open = (appid) => navigate(`/game/${appid}`);

    const formatPrice = (price) => {
        if (!price) return null;
        const fmt = (cents) => `$${(Number(cents) / 100).toFixed(2)}`;
        if (price.discountPercent > 0) {
            return (
                <span className="search-price">
                    <span className="search-price-strike">{fmt(price.initial)}</span>
                    <span className="search-price-final">{fmt(price.final)}</span>
                    <span className="search-price-discount">-{price.discountPercent}%</span>
                </span>
            );
        }
        return <span className="search-price">{fmt(price.final)}</span>;
    };

    return (
        <div className="search-page">
            <form className="search-page-form" onSubmit={submit}>
                <input
                    type="text"
                    className="search-page-input"
                    placeholder="Search games on Steam..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    autoFocus
                />
                <button type="submit" className="search-page-btn">Search</button>
            </form>

            {loading && <div className="search-status">Searching...</div>}
            {error && <div className="search-status search-error">{error}</div>}

            {!loading && !error && initialQuery && results.length === 0 && (
                <div className="search-status">No results for "{initialQuery}".</div>
            )}

            {results.length > 0 && (
                <div className="search-results-grid">
                    {results.map((g, idx) => (
                        <div
                            key={g.appid}
                            className="search-result-card"
                            onClick={() => open(g.appid)}
                            onMouseEnter={() => { prefetchGame(g.appid); prefetchSimilar(g.appid); prefetchDeals(g.appid, g.name); preloadImage(g.header_image); }}
                            onFocus={() => { prefetchGame(g.appid); prefetchDeals(g.appid, g.name); }}
                            role="button"
                            tabIndex="0"
                            onKeyDown={(e) => { if (e.key === 'Enter') open(g.appid); }}
                        >
                            <img
                                src={g.header_image}
                                alt={g.name}
                                className="search-result-image"
                                loading={idx < 6 ? 'eager' : 'lazy'}
                                decoding="async"
                            />
                            <div className="search-result-info">
                                <div className="search-result-title">{g.name}</div>
                                <div className="search-result-meta">
                                    {formatPrice(g.price)}
                                    {g.metascore != null && Number(g.metascore) > 0 && (
                                        <span className="search-meta-pill">Metacritic {g.metascore}</span>
                                    )}
                                    {reviewSummaries[g.appid] && reviewSummaries[g.appid].total > 0 && (
                                        <ReviewBadge summary={reviewSummaries[g.appid]} compact />
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export default Search;
