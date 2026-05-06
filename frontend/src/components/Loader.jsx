import React from 'react';

function Spinner({ size = 28 }) {
    return (
        <span
            className="spx-spinner"
            role="status"
            aria-label="Loading"
            style={{ width: size, height: size, borderWidth: Math.max(2, Math.round(size / 10)) }}
        />
    );
}

function CardsSkeleton({ count = 8 }) {
    return (
        <div className="library-container" aria-hidden="true">
            {Array.from({ length: count }).map((_, i) => (
                <div className="spx-card-skel" key={i}>
                    <div className="spx-skeleton spx-card-skel-img" />
                    <div style={{ padding: '10px 12px' }}>
                        <div className="spx-skeleton" style={{ height: 14, width: '70%', marginBottom: 8 }} />
                        <div className="spx-skeleton" style={{ height: 10, width: '40%' }} />
                    </div>
                </div>
            ))}
        </div>
    );
}

function RowsSkeleton({ count = 5 }) {
    return (
        <div aria-hidden="true" style={{ width: '100%' }}>
            {Array.from({ length: count }).map((_, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 10px' }}>
                    <div className="spx-skeleton" style={{ width: 32, height: 32, borderRadius: 4 }} />
                    <div className="spx-skeleton" style={{ flex: 1, height: 14 }} />
                    <div className="spx-skeleton" style={{ width: 48, height: 14 }} />
                </div>
            ))}
        </div>
    );
}

function Loader({ variant = 'status', count, size, label }) {
    if (variant === 'cards') return <CardsSkeleton count={count ?? 8} />;
    if (variant === 'rows') return <RowsSkeleton count={count ?? 5} />;
    if (variant === 'page') {
        return (
            <div className="spx-page-loader" role="status" aria-label={label || 'Loading'}>
                <Spinner size={size ?? 48} />
            </div>
        );
    }
    if (variant === 'inline') {
        return (
            <span className="spx-inline-loader" role="status" aria-label={label || 'Loading'}>
                <Spinner size={size ?? 14} />
                {label ? <span>{label}</span> : null}
            </span>
        );
    }
    return (
        <div className="spx-status-loader" role="status" aria-label={label || 'Loading'}>
            <Spinner size={size ?? 28} />
            {label ? <span style={{ marginLeft: 10, color: 'var(--steam-text-muted)' }}>{label}</span> : null}
        </div>
    );
}

export default Loader;
