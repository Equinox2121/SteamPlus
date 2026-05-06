# SteamPlus — App Entry Point Overview
 
This document covers the two root entry-point files: `App.jsx` and `main.jsx`. These files run before any page or component renders and are responsible for bootstrapping the entire application.
 
---
 
## Table of Contents
 
- [App.jsx](#appjsx)
- [main.jsx](#mainjsx)
- [Startup Sequence](#startup-sequence)
- [Route Table](#route-table)
---
 
## App.jsx
 
The root React component that composes the full application tree.
 
### Responsibilities
 
- Wraps the entire app in `<AuthProvider>` so every component has access to authentication state via `useAuth()`
- Sets up `<BrowserRouter>` and defines all client-side routes via React Router v6
- Lazy-loads every page component with `React.lazy()` so their JS bundles are only downloaded when first needed
- Wraps all routes in `<Suspense>` with a lightweight fallback so the app never shows a blank screen during chunk loading
- On mount, fires two non-blocking startup tasks via `useEffect`:
  - `idlePrefetchRoutes()` — queues all page bundles for download during browser idle time so subsequent navigations feel instant
  - `warmBackend()` — sends a lightweight ping to the backend to wake it up and pre-establish the connection before the user makes a real request
### Lazy-Loaded Pages
 
All pages are loaded on demand via `React.lazy()`:
 
```js
const Home           = lazy(() => import('./pages/Home'));
const Friends        = lazy(() => import('./pages/Friends'));
const Profile        = lazy(() => import('./pages/Profile'));
const CompleteProfile= lazy(() => import('./pages/CompleteProfile'));
const Game           = lazy(() => import('./pages/Game'));
const Support        = lazy(() => import('./pages/Support'));
const Search         = lazy(() => import('./pages/Search'));
```
 
### Component Tree
 
```
<AuthProvider>
  <BrowserRouter>
    <AppContent>
      <Navbar />
      <Suspense fallback="Loading...">
        <Routes> ... </Routes>
      </Suspense>
    </AppContent>
  </BrowserRouter>
</AuthProvider>
```
 
---
 
## main.jsx
 
The Vite entry point that mounts the React app and configures three global behaviors before rendering.
 
### 1. Backend Preconnect
 
Before React mounts, `main.jsx` injects `<link rel="preconnect">` and `<link rel="dns-prefetch">` tags into `<head>` pointing at the backend origin. This instructs the browser to resolve DNS and open a TCP/TLS connection immediately — reducing latency on the very first API call.
 
```js
<link rel="preconnect" href="https://your-backend.com" crossorigin />
<link rel="dns-prefetch" href="https://your-backend.com" />
```
 
### 2. JWT Token Capture from OAuth Redirect
 
After a Steam OAuth login, the backend redirects back to the frontend with a JWT token embedded in either the URL hash (`#token=...`) or query string (`?token=...`). Before React renders, `main.jsx`:
 
1. Reads the token from the URL
2. Stores it in `localStorage` under the key `sp_jwt`
3. Strips the token from the URL using `history.replaceState` so it never appears in browser history or shareable links
```
Steam → backend callback → redirect to /?token=eyJ...
         ↓
main.jsx captures token
         ↓
stores in localStorage as sp_jwt
         ↓
cleans URL → React renders normally
```
 
### 3. Global Fetch Interceptor
 
`main.jsx` wraps the native `window.fetch` with a custom interceptor. For every request made to `VITE_BACKEND_URL`, it automatically reads the JWT from `localStorage` and injects it as an `Authorization: Bearer <token>` header. No component or utility in the codebase needs to manually attach auth headers — it is handled transparently at the network layer.
 
```js
// Without interceptor — components must manually attach token
fetch(`${BACKEND_URL}/steam/library`, {
  headers: { Authorization: `Bearer ${token}` }
});
 
// With interceptor — token is injected automatically
fetch(`${BACKEND_URL}/steam/library`);
```
 
Requests to any origin other than `VITE_BACKEND_URL` are passed through completely untouched.
 
---
 
## Startup Sequence
 
The following happens in order when the app first loads in the browser:
 
```
1. main.jsx runs (before React mounts)
   ├── Inject <link rel="preconnect"> and <link rel="dns-prefetch"> into <head>
   ├── Check URL hash and query string for OAuth token
   │     └── If found: store in localStorage, clean URL
   └── Patch window.fetch with JWT interceptor
 
2. React renders
   └── <AuthProvider> initializes auth state
         └── <Router> + <Routes> set up navigation
               └── <AppContent> mounts
                     ├── idlePrefetchRoutes() — queues all page bundles for idle download
                     └── warmBackend() — pings backend to pre-establish connection
```
 
---
 
## Route Table
 
| Path | Component | Notes |
|---|---|---|
| `/` | — | Redirects to `/home` |
| `/home` | `Home` | Store and discovery page |
| `/friends` | `Friends` | Friend activity feed |
| `/login` | `Home` | Renders Home; login modal opens via route detection |
| `/profile` | `Profile` | User account and library page |
| `/complete-profile` | `CompleteProfile` | Post-OAuth username setup |
| `/game/:appid` | `Game` | Game detail page (dynamic route) |
| `/search` | `Search` | Full search results page |
| `/support` | `Support` | Support ticket submission form |
