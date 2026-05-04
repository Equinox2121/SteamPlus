import React, { useEffect, useMemo, useState } from 'react';
import { prefetchDeals, getCachedDeals } from '../utils/prefetch';

const formatPrice = (n, currency) => {
    if (!Number.isFinite(Number(n))) return null;
    const v = Number(n);
    if (currency === 'USD' || !currency) return `$${v.toFixed(2)}`;
    return `${v.toFixed(2)} ${currency}`;
};

const renderRow = (offer, currency) => (
    <a
        key={offer.id}
        href={offer.url}
        target="_blank"
        rel="noopener noreferrer"
        className="deal-offer-row"
    >
        <div className="deal-offer-shop">
            <span className="deal-offer-shop-name">{offer.merchantName}</span>
            <span className="deal-offer-meta">
                {offer.region?.name && <span className="deal-offer-region">{offer.region.name}</span>}
                {offer.activationPlatform && <span className="deal-offer-drm">{offer.activationPlatform}</span>}
                {offer.account && <span className="deal-offer-warn">account</span>}
                {offer.rating?.score && (
                    <span className="deal-offer-rating">★ {offer.rating.score.toFixed(1)} ({offer.rating.count})</span>
                )}
            </span>
            {offer.voucher && (
                <span className="deal-offer-voucher">
                    code <strong>{offer.voucher.code}</strong>
                    {offer.voucher.value ? ` (-${offer.voucher.value}${offer.voucher.type === '%' ? '%' : ''})` : ''}
                </span>
            )}
        </div>
        <div className="deal-offer-pricing">
            {offer.originalPrice > offer.price && (
                <span className="deal-offer-regular">{formatPrice(offer.originalPrice, currency)}</span>
            )}
            <span className="deal-offer-price">{formatPrice(offer.price, currency)}</span>
            {offer.discountPercent > 0 && <span className="deal-offer-discount">-{offer.discountPercent}%</span>}
        </div>
    </a>
);

function DealsWidget({ appid, gameName }) {
    const cached = getCachedDeals(appid);
    const [data, setData] = useState(cached);
    const [loading, setLoading] = useState(!cached);
    const [editionId, setEditionId] = useState(null);
    const [showAll, setShowAll] = useState({ official: false, keyshop: false });

    useEffect(() => {
        let active = true;
        setLoading(!getCachedDeals(appid));
        prefetchDeals(appid, gameName).then((d) => {
            if (active) {
                setData(d);
                setLoading(false);
            }
        });
        return () => { active = false; };
    }, [appid, gameName]);

    useEffect(() => {
        if (!data || !data.editions) return;
        const standard = data.editions.find((e) => /standard/i.test(e.name)) || data.editions[0];
        if (standard) setEditionId(standard.id);
    }, [data]);

    const groups = useMemo(() => {
        if (!data || !Array.isArray(data.offers)) return { official: [], keyshop: [] };
        const filtered = editionId ? data.offers.filter((o) => o.edition.id === editionId) : data.offers;
        return {
            official: filtered.filter((o) => o.isOfficial).sort((a, b) => a.price - b.price),
            keyshop: filtered.filter((o) => !o.isOfficial).sort((a, b) => a.price - b.price),
        };
    }, [data, editionId]);

    if (loading) return <div className="deals-widget deals-widget-loading">Loading deals...</div>;

    if (!data || data.available === false) {
        const reason = data?.reason;
        return (
            <div className="deals-widget deals-widget-empty">
                <div className="deals-widget-title">Best Deals</div>
                <div className="deals-widget-msg">
                    {reason === 'not_found_on_aks' && 'Not listed on AllKeyShop yet.'}
                    {reason === 'parse_failed' && 'Could not read AllKeyShop listing.'}
                    {reason === 'invalid_appid' && 'Invalid app id.'}
                    {!reason && 'Deals unavailable right now.'}
                </div>
            </div>
        );
    }

    const cheapestOfficial = groups.official[0];
    const cheapestKeyshop = groups.keyshop[0];
    const officialList = showAll.official ? groups.official : groups.official.slice(0, 5);
    const keyshopList = showAll.keyshop ? groups.keyshop : groups.keyshop.slice(0, 8);

    return (
        <div className="deals-widget">
            <div className="deals-widget-header">
                <div className="deals-widget-title">Best Deals</div>
                {data.sourceUrl && (
                    <a className="deals-widget-link" href={data.sourceUrl} target="_blank" rel="noopener noreferrer">
                        Full list on AllKeyShop →
                    </a>
                )}
            </div>

            {data.editions && data.editions.length > 1 && (
                <div className="deals-edition-tabs">
                    {data.editions.map((e) => (
                        <button
                            key={e.id}
                            className={`deals-edition-tab ${editionId === e.id ? 'active' : ''}`}
                            onClick={() => { setEditionId(e.id); setShowAll({ official: false, keyshop: false }); }}
                        >
                            {e.name}
                        </button>
                    ))}
                </div>
            )}

            <div className="deals-summary-row">
                {cheapestOfficial && (
                    <div className="deals-summary-pill">
                        Cheapest official: <strong>{formatPrice(cheapestOfficial.price, data.currency)}</strong>
                        <span className="deals-summary-low"> · {cheapestOfficial.merchantName}</span>
                    </div>
                )}
                {cheapestKeyshop && (
                    <div className="deals-summary-pill keys">
                        Cheapest keyshop: <strong>{formatPrice(cheapestKeyshop.price, data.currency)}</strong>
                        <span className="deals-summary-low"> · {cheapestKeyshop.merchantName}</span>
                    </div>
                )}
            </div>

            <div className="deals-columns">
                <div className="deals-column">
                    <div className="deals-column-title">Official Stores ({groups.official.length})</div>
                    {officialList.length === 0 ? (
                        <div className="deals-column-empty">No official offers for this edition.</div>
                    ) : (
                        <>
                            <div className="deals-offer-list">
                                {officialList.map((o) => renderRow(o, data.currency))}
                            </div>
                            {groups.official.length > 5 && (
                                <button
                                    className="deals-show-more"
                                    onClick={() => setShowAll((p) => ({ ...p, official: !p.official }))}
                                >
                                    {showAll.official ? 'Show fewer' : `Show all ${groups.official.length}`}
                                </button>
                            )}
                        </>
                    )}
                </div>
                <div className="deals-column">
                    <div className="deals-column-title">
                        Keyshops ({groups.keyshop.length}) <span className="deals-column-tag">resellers</span>
                    </div>
                    {keyshopList.length === 0 ? (
                        <div className="deals-column-empty">No keyshop offers for this edition.</div>
                    ) : (
                        <>
                            <div className="deals-offer-list">
                                {keyshopList.map((o) => renderRow(o, data.currency))}
                            </div>
                            {groups.keyshop.length > 8 && (
                                <button
                                    className="deals-show-more"
                                    onClick={() => setShowAll((p) => ({ ...p, keyshop: !p.keyshop }))}
                                >
                                    {showAll.keyshop ? 'Show fewer' : `Show all ${groups.keyshop.length}`}
                                </button>
                            )}
                        </>
                    )}
                </div>
            </div>

            <div className="deals-widget-footnote">
                Data via AllKeyShop · keyshops are third-party resellers; check seller reputation before purchase · {data.fetchedAt && `prices fetched ${new Date(data.fetchedAt).toLocaleTimeString()}`}
            </div>
        </div>
    );
}

export default DealsWidget;
