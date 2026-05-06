import React from 'react';
import { FaThumbsUp, FaThumbsDown } from 'react-icons/fa';

function ReviewBadge({ summary, compact = false }) {
    if (!summary || !summary.total || summary.total === 0) {
        if (compact) return null;
        return <span className="review-badge review-badge-empty">No user reviews</span>;
    }
    const pct = summary.positivePercent;
    const tone = pct == null ? 'mixed' : pct >= 70 ? 'positive' : pct <= 40 ? 'negative' : 'mixed';
    const Icon = tone === 'negative' ? FaThumbsDown : FaThumbsUp;
    return (
        <span className={`review-badge review-badge-${tone}`} title={summary.label}>
            <span className="review-badge-icon" aria-hidden="true"><Icon /></span>
            <span className="review-badge-pct">{pct != null ? `${pct}%` : '—'}</span>
            {!compact && <span className="review-badge-count">({summary.total})</span>}
        </span>
    );
}

export default ReviewBadge;
