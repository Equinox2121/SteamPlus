# Frontend Components Overview

This project contains several React components used to build a Steam-like game dashboard with deals, reviews, user stats, and library management.

---

## DealsWidget

A marketplace component that displays game deals from official stores and third-party keyshops.

### Features
- Fetches and caches deal data per game
- Separates offers into:
  - Official stores
  - Keyshops (third-party resellers)
- Supports:
  - Edition switching (e.g., Standard, Deluxe)
  - Show more / show less toggles
  - Cheapest price summary
- Displays:
  - Prices (original, discounted)
  - Voucher codes
  - Ratings and merchant info

### Data Source
- AllKeyShop API (via backend utility functions)

---

## ReviewBadge

A compact UI component that summarizes review sentiment.

### Features
- Shows:
  - Positive / negative / mixed indicator
  - Percentage of positive reviews
  - Total review count
- Compact mode available for small UI areas

---

## ReviewSection

Full review system for games.

### Features
- User authentication-aware review submission
- Create, edit, and delete reviews
- Displays:
  - Review summary (recommendation percentage)
  - List of all user reviews
- Supports:
  - Text reviews (optional body)
  - Recommendation toggle (recommended / not recommended)

---

## UserHeader

Displays user profile header information.

### Features
- User avatar (with fallback image)
- Username greeting
- Steam-specific settings indicator
- Temporary privacy popup (auto-dismisses)

---

## StatsDashboard

Displays user game and account statistics.

### Features
- Basic stats:
  - Steam level
  - Recent playtime
  - Library size
  - Active games
- Expandable section:
  - Achievements
  - Top genres
  - Most played game
  - Average playtime
- Toggle between compact and expanded views

---

## LibraryGrid

Displays the user’s Steam game library.

### Features
- Game grid layout with:
  - Cover image
  - Game name
  - Playtime
- Click actions:
  - Open game details page
  - Open game stats modal
- Stats button per game

---

## GameStatsModal

Modal window showing detailed game statistics.

### Features
- Achievement progress (unlocked / total)
- Achievement grid (icons, rarity, status)
- Custom game stats list
- Scroll-limited preview of achievements

---

## UserAccount (Main Page Component)

Central container that ties all features together.

### Responsibilities
- Loads user session data
- Fetches:
  - Steam library
  - User stats
  - Extended stats
  - Game-specific stats
- Manages UI state:
  - Expanded stats panel
  - Modal visibility
  - Cached game stats

### Data Endpoints Used
- `/steam/library`
- `/steam/user-stats`
- `/steam/user-extended-stats`
- `/steam/game-stats/:appid`

---

## Architecture Notes

- Uses React functional components with hooks
- Backend communication via `fetch` with credentials
- Environment-based API URL:
  - `import.meta.env.VITE_BACKEND_URL`
- Client-side caching for:
  - Deals
  - Game stats
- Conditional rendering based on authentication state

---

## Folder Responsibilities (Suggested)

- `components/`
  - UI building blocks (widgets, modals, badges)
- `pages/`
  - Full page containers (UserAccount)
- `utils/`
  - API calls and caching logic
- `assets/`
  - Images and icons

---

## Summary

This frontend is a modular game dashboard system combining:
- Deal aggregation
- User game library
- Steam account statistics
- Community reviews
