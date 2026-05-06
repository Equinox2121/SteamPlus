# SteamPlus Backend

The SteamPlus backend is a Node.js and Express API that powers a Steam-integrated web application. It provides authentication, Steam data integration, recommendations, reviews, and third-party deal aggregation.

---

## Features

### Authentication
- Username/password login with bcrypt
- JWT-based authentication (stored in cookies)
- Steam OAuth integration via Passport
- Session persistence (30 days)

### Steam Integration
- Fetch user game library
- Retrieve recently played games
- Friend activity and status
- Game details and metadata
- Player stats and achievements

### Recommendation Engine
- Personalized recommendations based on owned games
- Tag-based scoring using SteamSpy
- Diversity-aware reranking
- Fallback to trending games
- Categorized results (top picks, trending, etc.)

### Deals Integration
- AllKeyShop API integration
- Batch deal lookup by Steam app IDs
- Cached results for performance

### Reviews System
- Create, update, delete reviews
- Aggregated review summaries
- Per-user review tracking

### Search
- Steam store search proxy
- Cached search results

### Support
- Sends user reports to a Discord webhook

---

## Project Structure

routes/
  auth.js
  steam.js
  deals.js
  reviews.js
  search.js

services/
  recommendationEngine.js
  allKeyShop.js
  dealsWarmer.js

middleware/
  authMiddleware.js

config/
  database.js
  origins.js

---

## Environment Variables

JWT_SECRET=your_jwt_secret  
STEAM_API_KEY=your_steam_api_key  
SUPPORT_WEBHOOK_URL=your_discord_webhook_url  

DB_HOST=your_database_host  
DB_USER=your_database_user  
DB_PASS=your_database_password  
DB_NAME=your_database_name  

FRONTEND_URL=your_frontend_url  
NODE_ENV=production  

---

## Running Locally

1. Install dependencies  
npm install  

2. Start the server  
npm start  

3. The server will run on  
http://localhost:5175  

---

## API Endpoints

Auth  
POST /register  
POST /login  
POST /logout  
GET /test  
POST /complete-steam-profile  

User  
GET /user  

Steam  
GET /steam/library  
GET /steam/top-games  
GET /steam/game/:appid  
GET /steam/recommendations/owned  
GET /steam/recommendations/:appid  
GET /steam/user-stats  
GET /steam/user-extended-stats  
GET /steam/friends-activity  

Deals  
GET /deals/health  
GET /deals/by-steam-app-ids  
GET /deals/:appid  
POST /deals/warm  

Reviews  
GET /reviews/summary  
GET /reviews/:appid  
PUT /reviews/:appid  
DELETE /reviews/:appid  

Search  
GET /steam/search?q=query  

Support  
POST /support  

---

## Authentication Flow

Standard Login  
1. User submits username and password  
2. Password is validated using bcrypt  
3. JWT is issued  
4. Token is stored in an HTTP-only cookie  

Steam Login  
1. User is redirected to Steam authentication  
2. On return:  
   - Existing user → logged in  
   - New user → redirected to profile completion  
3. JWT is issued after authentication  

---

## Recommendation System Overview

1. Build a user profile from top played games  
2. Extract tags using SteamSpy  
3. Score candidate games based on tag similarity and popularity  
4. Apply diversity reranking  
5. Return ranked and categorized recommendations  

---

## Caching

- Review summaries: 60 seconds  
- Search results: 10 minutes  
- Game stats: per user/game cache  
- SteamSpy responses cached  

---

## Security

- Password hashing with bcrypt  
- JWT authentication middleware  
- Parameterized SQL queries  
- Input validation on all endpoints  
- Secure cookie configuration  

---

## Deployment Notes

PORT = process.env.PORT || 5175  

- Set environment variables in your hosting platform  
- Connects to a MySQL database using a connection pool  
- Designed for stateless deployment (JWT-based)  

---

## Future Improvements

- Redis caching  
- Rate limiting  
- Improved Steam API caching  
- Pagination improvements  
- Recommendation tuning  
