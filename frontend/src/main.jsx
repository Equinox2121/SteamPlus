import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;
const TOKEN_KEY = 'sp_jwt';

if (typeof document !== 'undefined' && BACKEND_URL) {
  try {
    const origin = new URL(BACKEND_URL).origin;
    const link = document.createElement('link');
    link.rel = 'preconnect';
    link.href = origin;
    link.crossOrigin = 'anonymous';
    document.head.appendChild(link);
    const dns = document.createElement('link');
    dns.rel = 'dns-prefetch';
    dns.href = origin;
    document.head.appendChild(dns);
  } catch {}
}

if (typeof window !== 'undefined') {
  let captured = null;
  if (window.location.hash) {
    const fromHash = new URLSearchParams(window.location.hash.slice(1));
    captured = fromHash.get('token');
  }
  if (!captured && window.location.search) {
    const fromQuery = new URLSearchParams(window.location.search);
    captured = fromQuery.get('token');
  }
  if (captured) {
    localStorage.setItem(TOKEN_KEY, captured);
    const url = new URL(window.location.href);
    url.hash = '';
    url.searchParams.delete('token');
    history.replaceState(null, '', url.pathname + url.search);
    console.info('[auth] token captured from redirect');
  }
}

const originalFetch = window.fetch.bind(window);
window.fetch = (input, init = {}) => {
  const url = typeof input === 'string' ? input : (input && input.url) || '';
  if (BACKEND_URL && url.startsWith(BACKEND_URL)) {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) {
      const next = { ...init };
      const existing = next.headers || {};
      const headers = existing instanceof Headers
        ? Object.fromEntries(existing.entries())
        : { ...existing };
      if (!headers.Authorization && !headers.authorization) {
        headers.Authorization = `Bearer ${token}`;
      }
      next.headers = headers;
      return originalFetch(input, next);
    }
  }
  return originalFetch(input, init);
};

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
