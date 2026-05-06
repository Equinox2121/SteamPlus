# SteamPlus
 
A full-featured Steam companion web application built with React and Vite. SteamPlus enhances the Steam experience by combining personalized game discovery, deal aggregation, friend activity tracking, community reviews, and detailed library management into a single polished interface.
 
---
 
## Table of Contents
 
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Project Structure](#project-structure)
- [Pages](#pages)
- [Components](#components)
- [Authentication Flow](#authentication-flow)
- [API Endpoints Used](#api-endpoints-used)
- [Architecture Notes](#architecture-notes)
- [Performance](#performance)
- [Folder Responsibilities](#folder-responsibilities)
- [Summary](#summary)
---
 
## Features
 
- **Steam OAuth Login** — Authenticate via Steam OpenID or register with email/username/password
- **Personalized Store** — AI-powered game recommendations based on your owned library and playtime patterns, organized into Steam-style category rows (Because You Play, Trending Now, Deep Dives, New Discoveries, Top Picks)
- **Game Detail Pages** — Rich per-game views with screenshots, metadata, Metacritic scores, genre tags, pricing, deals, site reviews, and similar game suggestions
- **Deal Aggregation** — Real-time price comparisons across official stores and keyshops, with edition switching, voucher codes, merchant ratings, and cheapest-price summaries
- **Community Reviews** — Write, edit, and delete reviews with recommendation toggles; aggregated sentiment badges shown across the app
- **Friend Activity Feed** — Live view of what your Steam friends are currently playing and their recent game history
- **Full Search** — Instant inline search dropdown with image previews plus a dedicated full-results page with pricing and review data
- **User Library** — Browse your entire Steam game library with playtime stats, per-game achievement progress, and detailed game stat modals
- **User Stats Dashboard** — Steam level, recent playtime, library size, top genres, most-played games, and achievement summaries
- **Saved Games** — Client-side bookmarking of games for quick access
- **Support Tickets** — Submit bug reports or feedback directly from the app
---
 
## Tech Stack
 
| Layer | Technology |
|---|---|
| Framework | React 18 |
| Routing | React Router v6 |
| Build Tool | Vite |
| Styling | Custom CSS (Steam-inspired dark theme) |
| Auth | Steam OpenID OAuth + custom JWT session |
| State | React Context API + component-level hooks |
| APIs | Steam Web API, gg.deals, Metacritic (via backend proxy) |
| Backend | Node.js / Express (separate repository) |
 
---
 
## Getting Started
 
### Prerequisites
 
- Node.js 18+
- A running instance of the SteamPlus backend server
- Steam API Key (configured on the backend)
### Installation
 
```bash
git clone https://github.com/your-org/steamplus-frontend.git
cd steamplus-frontend
npm install
```
 
### Environment Variables
 
Create a `.env` file in the project root:
 
```env
VITE_BACKEND_URL=http://localhost:5000
```
 
### Running Locally
 
```bash
npm run dev
```
 
The app will be available at `http://localhost:5173`.
 
### Building for Production
 
```bash
npm run build
npm run preview
```
 
---
 
## Project Structure
 
```
src/
├── assets/                  # Static images and icons
│   ├── SteamPlus Logo.png
│   └── NoAvatar.png
├── components/              # Reusable UI building blocks
│   ├── DealsWidget          # Price comparison across stores and keyshops
│   ├── GameStatsModal       # Per-game achievement and stats modal
│   ├── LibraryGrid          # User's Steam library grid
│   ├── ReviewBadge          # Compact sentiment summary badge
│   ├── ReviewSection        # Full review submission and listing UI
│   ├── StatsDashboard       # User account and playtime statistics
│   ├── UserAccount          # Main profile page container
│   └── UserHeader           # Profile header with avatar and greeting
├── context/
│   └── AuthContext          # Global auth state (login, logout, Steam OAuth, profile completion)
├── pages/
│   ├── CompleteProfile      # Post-Steam-OAuth username setup screen
│   ├── Friends              # Friend activity feed page
│   ├── Game                 # Individual game detail page with tabbed layout
│   ├── Home                 # Store / discovery homepage
│   ├── LoginModal           # Login and registration modal
│   ├── Navbar               # Top navigation bar with inline search
│   ├── Profile              # User profile page (wraps UserAccount)
│   ├── Search               # Full search results page
│   └── Support              # Support ticket submission form
├── utils/
│   └── prefetch             # In-memory caching, prefetch, and API helpers
└── settings.js              # Feature flags (e.g. developer mode)
```
 
---
 
## Pages
 
### Home (`/home`)
 
The central store and discovery page.
 
**Features:**
- Hero header with Steam catalog search bar and "Browse trending" shortcut
- Featured For You — top personalized pick from the user's library profile
- Steam-style category sections when category data is available:
  - **Because You Play** — matches the user's most-played genres
  - **Trending Now** — games rising fast on Steam this week
  - **Deep Dives** — titles players spend long sessions in
  - **New Discoveries** — fresh picks outside the user's usual genres
  - **Top Picks** — best overall matches for the user's taste
- Fallback flat recommendation grid with genre filter chips when categories are unavailable
- **On Sale Now** — top discounts surfaced from deal data, sorted by discount percentage
- **Trending on Steam** — preloaded top games from backend
- Unauthenticated state with sign-in prompt
- Developer mode overlays (match %, confidence, signal breakdown) controlled by `settings.js`
---
 
### Game (`/game/:appid`)
 
Detailed view for an individual Steam game, organized into four tabs.
 
**Overview Tab:**
- Review sentiment badge and summary stats
- Main header image and screenshot gallery with lightbox
- Sidebar with game description, release date, developer, publisher, Metacritic score, and genre tags
- Price display with discount badge
- Link to official Steam store page
- DealsWidget embedded below
**Deals Tab:**
- Standalone DealsWidget for the current game
**Site Reviews Tab:**
- Full ReviewSection component — submit, edit, delete, and browse community reviews
**Similar Games Tab:**
- Grid of AI-recommended similar titles with tags and pricing
- Hover prefetching for fast navigation
**Additional Features:**
- Save / unsave button (persisted in `localStorage`)
- Back navigation
- Lightbox screenshot viewer
---
 
### Friends (`/friends`)
 
Live friend activity feed.
 
**Features:**
- **Live Feed** — cards for each Steam friend showing avatar, username, online status, current game (if playing), and recent game summary
- **Recent Games Your Friends Played** — flat grid of the last 10 games across all friends, with friend attribution and playtime
- Unauthenticated state with redirect prompt
- Graceful error and empty states
---
 
### Search (`/search?q=`)
 
Full-page search results.
 
**Features:**
- Search form with query persistence via URL params
- Results grid with game images, names, pricing (with discount formatting), Metacritic scores, and ReviewBadge
- Prefetching on hover/focus for instant game page loads
- Keyboard accessible (Enter to navigate, Tab to move through results)
- AbortController-based cancellation for stale requests
---
 
### Profile (`/profile`)
 
User account and library management page. Renders the `UserAccount` component.
 
---
 
### CompleteProfile (`/complete-profile`)
 
Shown after a first-time Steam OAuth login when a username has not yet been set.
 
**Features:**
- Username input form
- Calls `completeSteamProfile` from AuthContext
- Redirects to `/home` on success
---
 
### Support (`/support`)
 
Support ticket submission form.
 
**Features:**
- Fields for header, email address, and body (up to 4,000 characters)
- POST to `/support` backend endpoint
- Success and error feedback states
- Sending disabled state to prevent double submission
---
 
### LoginModal
 
Modal overlay for sign-in and registration. Accessible from the Navbar login button or the `/login` route.
 
**Features:**
- Toggle between Sign In and Create Account modes
- Email, username, and password fields (email shown only in register mode)
- Steam OAuth sign-in button
- Overlay click-to-close (mousedown + mouseup tracking to prevent accidental dismissal)
- Error and success message display
---
 
### Navbar
 
Persistent top navigation bar present on all pages.
 
**Features:**
- Logo with home navigation
- Nav links: Store, Friends, Community, About, Support (with active state highlighting)
- Inline search with:
  - Debounced live results dropdown (200ms)
  - Game thumbnail previews
  - Keyboard navigation (Arrow keys, Enter, Escape)
  - "See all results" footer link to full search page
  - AbortController cancellation for stale requests
- Authenticated state: username, avatar, and dropdown with Logout
- Unauthenticated state: Login button (hidden on `/complete-profile`)
- Route prefetching on hover/focus for all nav links
---
 
## Components
 
### DealsWidget
 
A marketplace component that fetches and displays real-time game deals from official stores and third-party keyshops.
 
**Features:**
- Fetches and caches deal data per `appid` and game name
- Separates offers into:
  - Official stores (Steam, Epic, GOG, etc.)
  - Keyshops (third-party resellers)
- Edition switching (e.g., Standard, Deluxe, Ultimate)
- Show more / show less toggles per section
- Cheapest price summary at the top
- Displays:
  - Original and discounted prices
  - Discount percentage badges
  - Voucher codes (if available)
  - Merchant name and rating
- Handles unavailable and loading states gracefully
**Data Source:**
- gg.deals API via backend proxy (`/deals/by-steam-app-ids`, `/deals/search`)
---
 
### ReviewBadge
 
A compact UI component that summarizes aggregated review sentiment.
 
**Features:**
- Color-coded sentiment indicator (positive / mixed / negative)
- Positive percentage display
- Total review count
- Compact mode for use in grid cards and search results
- Full mode for game overview sections
---
 
### ReviewSection
 
Full community review system embedded on game detail pages.
 
**Features:**
- Authentication-aware — prompts unauthenticated users to log in before reviewing
- Create new reviews with:
  - Recommendation toggle (Recommended / Not Recommended)
  - Optional text body
- Edit and delete own reviews
- Displays all reviews for a game with usernames and timestamps
- Review summary bar showing overall recommendation percentage
- Calls `onChange` callback to refresh ReviewBadge data after mutations
**Data Endpoints:**
- `GET /reviews/:appid`
- `POST /reviews/:appid`
- `PUT /reviews/:appid/:reviewId`
- `DELETE /reviews/:appid/:reviewId`
---
 
### UserHeader
 
Displays the top section of the user profile page.
 
**Features:**
- User avatar with fallback to `NoAvatar.png`
- Username greeting
- Steam-linked account indicator
- Temporary privacy notice popup (auto-dismisses)
---
 
### StatsDashboard
 
Displays user game and account statistics in a collapsible panel.
 
**Features:**
- Basic stats row:
  - Steam level
  - Recent playtime (hours)
  - Library size (total games owned)
  - Active games (played in the last 2 weeks)
- Expandable section:
  - Achievement count and completion percentage
  - Top genres derived from library
  - Most-played game with hours
  - Average playtime per game
- Toggle between compact summary and expanded detail views
---
 
### LibraryGrid
 
Displays the authenticated user's full Steam game library.
 
**Features:**
- Responsive game grid with cover image, game name, and playtime
- Click to navigate to game detail page
- Stats button per game to open GameStatsModal
- Empty and loading states
---
 
### GameStatsModal
 
Modal window showing per-game achievement and statistics data.
 
**Features:**
- Achievement progress bar (unlocked count / total)
- Scrollable achievement grid with:
  - Achievement icons
  - Names and descriptions
  - Rarity indicators
  - Locked / unlocked status
- Custom game stats list (kills, wins, hours, etc.)
- Scroll-limited preview with expand option
- Close button and overlay click-to-dismiss
---
 
### UserAccount (Main Profile Page Component)
 
The central container that orchestrates all profile-related components.
 
**Responsibilities:**
- Loads and validates user session via `AuthContext`
- Fetches and coordinates:
  - Steam game library (`/steam/library`)
  - Basic user stats (`/steam/user-stats`)
  - Extended stats (`/steam/user-extended-stats`)
  - Per-game stats on demand (`/steam/game-stats/:appid`)
- Manages UI state:
  - Expanded / collapsed stats panel
  - Active modal and selected game
  - Client-side cache for game stats (avoids re-fetching)
- Renders: `UserHeader` → `StatsDashboard` → `LibraryGrid` → `GameStatsModal`
---
 
## Authentication Flow
 
SteamPlus supports two parallel authentication methods:
 
### Email / Password
1. User opens the LoginModal and fills in username and password (or registers with email + username + password)
2. Credentials are sent to the backend which returns a session cookie
3. `AuthContext` updates global `user` state
4. Modal closes and the app re-renders with authenticated state
### Steam OpenID OAuth
1. User clicks "Sign in with Steam" — redirected to Steam's OpenID endpoint
2. Steam redirects back to the backend callback URL
3. Backend creates or retrieves the user account and sets a session cookie
4. If the Steam account has no username set yet, the user is redirected to `/complete-profile`
5. User submits a username via `completeSteamProfile()` in `AuthContext`
6. On success, redirected to `/home`
---
 
## API Endpoints Used
 
| Endpoint | Used By |
|---|---|
| `GET /steam/friends-activity` | Friends page |
| `GET /steam/top-games` | Home page (trending section) |
| `GET /steam/recommendations/owned` | Home page (personalized recommendations) |
| `GET /steam/library` | UserAccount |
| `GET /steam/user-stats` | StatsDashboard |
| `GET /steam/user-extended-stats` | StatsDashboard |
| `GET /steam/game-stats/:appid` | GameStatsModal |
| `GET /deals/by-steam-app-ids` | DealsWidget, Home (On Sale Now) |
| `GET /deals/search` | DealsWidget |
| `GET /game/:appid` | Game page (via prefetch utility) |
| `GET /game/:appid/similar` | Game page similar tab |
| `GET /search` | Search page and Navbar inline search |
| `GET /reviews/:appid` | ReviewSection |
| `POST /reviews/:appid` | ReviewSection |
| `PUT /reviews/:appid/:reviewId` | ReviewSection |
| `DELETE /reviews/:appid/:reviewId` | ReviewSection |
| `POST /support` | Support page |
| `POST /auth/steam` | Steam OAuth redirect |
 
---
 
## Architecture Notes
 
- All components are React functional components using hooks (`useState`, `useEffect`, `useMemo`, `useRef`)
- Global authentication state is managed via `AuthContext` and consumed with `useAuth()`
- All backend communication uses `fetch` with `credentials: 'include'` for cookie-based sessions
- Backend URL is environment-driven via `import.meta.env.VITE_BACKEND_URL`
- `settings.js` controls feature flags such as developer mode overlays
- Client-side caching is implemented in `utils/prefetch` for game data, similar game lists, and deal data — preventing redundant network requests during in-session navigation
- Conditional rendering throughout handles unauthenticated, loading, error, and empty states cleanly
---
 
## Performance
 
- **Route-level code splitting** via dynamic `import()` triggered on navbar link hover and focus, so pages are prefetched before the user clicks
- **Data prefetching** on game card hover — game detail, similar games, and deal data are all fetched and cached before navigation
- **Image preloading** via `preloadImage()` utility for above-the-fold and hovered game images
- **Lazy loading** for all off-screen images; `loading="eager"` and `fetchpriority="high"` for the first visible items in each view
- **Debounced search** (200ms) with `AbortController` cancellation so stale requests don't race with newer ones
- **In-memory caching** in the prefetch utility layer prevents duplicate API calls within the same session
---
 
## Folder Responsibilities
 
| Folder | Purpose |
|---|---|
| `components/` | Reusable UI building blocks — widgets, modals, badges, grids |
| `pages/` | Full page containers and route-level views |
| `context/` | Global state providers (auth, user session) |
| `utils/` | API call wrappers, caching logic, prefetch helpers |
| `assets/` | Static images and icons bundled at build time |
 
---
 
## Summary
 
SteamPlus is a modular, performance-conscious Steam companion frontend combining:
 
- **Deal aggregation** across official and keyshop sources
- **Personalized game discovery** powered by library analysis
- **User library and achievement tracking**
- **Steam account statistics**
- **Community review system**
- **Live friend activity monitoring**
- **Full catalog search**
Every feature is built around real Steam API data surfaced through a Node.js backend, with a React frontend optimized for fast navigation and a familiar Steam-inspired aesthetic.
