import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { fetchReviews, submitReview, deleteReview } from '../utils/prefetch';

const formatDate = (iso) => {
    if (!iso) return '';
    try {
        return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    } catch {
        return '';
    }
};

function ReviewSection({ appid, onChange }) {
    const { user } = useAuth();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const [draftRecommend, setDraftRecommend] = useState(true);
    const [draftBody, setDraftBody] = useState('');
    const [editing, setEditing] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState('');

    const load = async () => {
        setLoading(true);
        setError('');
        try {
            const result = await fetchReviews(appid);
            setData(result);
            if (result?.mine) {
                setDraftRecommend(result.mine.recommended);
                setDraftBody(result.mine.body || '');
                setEditing(false);
            } else {
                setDraftRecommend(true);
                setDraftBody('');
                setEditing(true);
            }
        } catch (e) {
            console.error(e);
            setError('Could not load reviews.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, [appid, user?.username]);

    const onSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        setSubmitError('');
        try {
            await submitReview(appid, { recommended: draftRecommend, body: draftBody });
            await load();
            if (onChange) onChange();
        } catch (err) {
            setSubmitError(err.message || 'Failed to submit review.');
        } finally {
            setSubmitting(false);
        }
    };

    const onDelete = async () => {
        if (!confirm('Delete your review?')) return;
        setSubmitting(true);
        try {
            await deleteReview(appid);
            await load();
            if (onChange) onChange();
        } catch (err) {
            setSubmitError(err.message || 'Failed to delete review.');
        } finally {
            setSubmitting(false);
        }
    };

    const summary = data?.summary;
    const reviews = data?.reviews || [];
    const mine = data?.mine || null;

    return (
        <div className="reviews-section">
            <div className="reviews-header">
                <h2>Site Reviews</h2>
                {summary && summary.total > 0 && (
                    <div className="reviews-summary">
                        <span className={`reviews-label ${summary.positivePercent >= 70 ? 'positive' : summary.positivePercent <= 40 ? 'negative' : 'mixed'}`}>
                            {summary.label}
                        </span>
                        <span className="reviews-summary-stats">
                            {summary.positivePercent != null ? `${summary.positivePercent}% recommend` : ''} · {summary.total} {summary.total === 1 ? 'review' : 'reviews'}
                        </span>
                    </div>
                )}
            </div>

            {loading ? (
                <div className="reviews-status">Loading reviews...</div>
            ) : error ? (
                <div className="reviews-status reviews-error">{error}</div>
            ) : (
                <>
                    {user ? (
                        <div className="reviews-form-card">
                            {!editing && mine ? (
                                <>
                                    <div className="reviews-form-header">
                                        <div className={`reviews-verdict ${mine.recommended ? 'positive' : 'negative'}`}>
                                            {mine.recommended ? 'You Recommend This' : 'You Do Not Recommend'}
                                        </div>
                                        <div className="reviews-form-actions">
                                            <button className="reviews-btn-secondary" onClick={() => setEditing(true)}>Edit</button>
                                            <button className="reviews-btn-danger" onClick={onDelete} disabled={submitting}>Delete</button>
                                        </div>
                                    </div>
                                    {mine.body && <div className="reviews-body">{mine.body}</div>}
                                    <div className="reviews-meta">Posted {formatDate(mine.updatedAt)}</div>
                                </>
                            ) : (
                                <form onSubmit={onSubmit}>
                                    <div className="reviews-toggle">
                                        <button
                                            type="button"
                                            className={`reviews-toggle-btn ${draftRecommend ? 'active positive' : ''}`}
                                            onClick={() => setDraftRecommend(true)}
                                        >
                                            👍 Recommended
                                        </button>
                                        <button
                                            type="button"
                                            className={`reviews-toggle-btn ${!draftRecommend ? 'active negative' : ''}`}
                                            onClick={() => setDraftRecommend(false)}
                                        >
                                            👎 Not Recommended
                                        </button>
                                    </div>
                                    <textarea
                                        className="reviews-textarea"
                                        placeholder="Share your thoughts (optional)..."
                                        value={draftBody}
                                        onChange={(e) => setDraftBody(e.target.value)}
                                        maxLength={4000}
                                    />
                                    <div className="reviews-form-footer">
                                        <span className="reviews-char-count">{draftBody.length} / 4000</span>
                                        <div className="reviews-form-actions">
                                            {mine && (
                                                <button type="button" className="reviews-btn-secondary" onClick={() => { setEditing(false); setDraftBody(mine.body || ''); setDraftRecommend(mine.recommended); }}>
                                                    Cancel
                                                </button>
                                            )}
                                            <button type="submit" className="reviews-btn-primary" disabled={submitting}>
                                                {submitting ? 'Saving...' : mine ? 'Update Review' : 'Post Review'}
                                            </button>
                                        </div>
                                    </div>
                                    {submitError && <div className="reviews-error">{submitError}</div>}
                                </form>
                            )}
                        </div>
                    ) : (
                        <div className="reviews-form-card reviews-signed-out">
                            Sign in to post a review.
                        </div>
                    )}

                    <div className="reviews-list">
                        {reviews.length === 0 ? (
                            <div className="reviews-status">Be the first to review this game.</div>
                        ) : (
                            reviews.map((r) => (
                                <div key={r.id} className="review-card">
                                    <div className="review-card-header">
                                        <span className="review-author">{r.user.username}</span>
                                        <span className={`reviews-verdict-pill ${r.recommended ? 'positive' : 'negative'}`}>
                                            {r.recommended ? 'Recommended' : 'Not Recommended'}
                                        </span>
                                        <span className="reviews-meta">{formatDate(r.updatedAt)}</span>
                                    </div>
                                    {r.body && <div className="reviews-body">{r.body}</div>}
                                </div>
                            ))
                        )}
                    </div>
                </>
            )}
        </div>
    );
}

export default ReviewSection;
