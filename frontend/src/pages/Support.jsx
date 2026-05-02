import React, { useState } from 'react';
import logo from '../assets/SteamPlus Logo.png';
import './LoginModal.css';

const SUPPORT_WEBHOOK_URL = 'https://discord.com/api/webhooks/1500251016199667894/XNVIjtKVmkJapH5Q6BfMMIKcdNvPR74z6Bln58f9AEAUYd49p6LVr4ndh2bjJQNQKtA1';

const Support = () => {
    const [header, setHeader] = useState('');
    const [email, setEmail] = useState('');
    const [body, setBody] = useState('');
    const [status, setStatus] = useState('idle');
    const [error, setError] = useState(null);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);
        setStatus('sending');

        const payload = {
            username: 'SteamPlus Support',
            embeds: [{
                title: header.slice(0, 256),
                description: body.slice(0, 4000),
                color: 0x66c0f4,
                fields: [{ name: 'Reply to', value: email, inline: false }],
                timestamp: new Date().toISOString()
            }]
        };

        try {
            const res = await fetch(SUPPORT_WEBHOOK_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!res.ok) {
                const text = await res.text();
                throw new Error(`Discord returned ${res.status}: ${text}`);
            }
            setStatus('sent');
            setHeader('');
            setEmail('');
            setBody('');
        } catch (err) {
            console.error('Support submission failed:', err);
            setError('Could not send your report. Please try again.');
            setStatus('idle');
        }
    };

    return (
        <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'flex-start',
            minHeight: 'calc(100vh - 80px)',
            backgroundColor: '#1b2838',
            padding: '40px 20px'
        }}>
            <div className="modal-content" style={{ position: 'relative', width: '500px', maxWidth: '100%' }}>
                <div className="login-modal-body">
                    <h1 style={{ marginBottom: '20px', fontSize: '24px', textAlign: 'center', color: '#ffffff' }}>
                        Submit a Support Report
                    </h1>

                    <div className="login-logo" style={{ textAlign: 'center', marginBottom: '20px' }}>
                        <img src={logo} alt="SteamPlus Logo" style={{ width: '120px' }} />
                    </div>

                    <p style={{ color: '#c6d4df', textAlign: 'center', marginBottom: '20px' }}>
                        Issues with SteamPlus? Send us a message.
                    </p>

                    <form onSubmit={handleSubmit} className="login-form">
                        <div className="input-group">
                            <label>Header</label>
                            <input
                                type="text"
                                name="header"
                                value={header}
                                onChange={(e) => setHeader(e.target.value)}
                                maxLength={256}
                                required
                            />
                        </div>

                        <div className="input-group">
                            <label>Email</label>
                            <input
                                type="email"
                                name="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />
                        </div>

                        <div className="input-group">
                            <label>Body</label>
                            <textarea
                                name="body"
                                value={body}
                                onChange={(e) => setBody(e.target.value)}
                                rows={8}
                                maxLength={4000}
                                required
                                style={{
                                    width: '100%',
                                    padding: '10px',
                                    backgroundColor: '#316282',
                                    border: '1px solid #67c1f5',
                                    borderRadius: '3px',
                                    color: '#ffffff',
                                    fontFamily: 'inherit',
                                    fontSize: '14px',
                                    resize: 'vertical',
                                    boxSizing: 'border-box'
                                }}
                            />
                        </div>

                        {error && <p className="error-message">{error}</p>}
                        {status === 'sent' && <p className="success-message">Report submitted. We'll be in touch.</p>}

                        <button
                            type="submit"
                            className="login-form-btn"
                            disabled={status === 'sending'}
                        >
                            {status === 'sending' ? 'Sending...' : 'Submit Report'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default Support;
