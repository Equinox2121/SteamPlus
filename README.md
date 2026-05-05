# SteamPlus 

SteamPlus is a full-stack web application designed to enhance the Steam user experience by expanding Steam's native web functionality in many ways. It provides a better deal recommendation algoritm for budget-conscious gamers, displays comprehensive profile statistics, and more! 

<img src="frontend/src/assets/SteamPlus%20Logo.png" alt="SteamPlus Logo" width="30%" />

**Problem Statement:**
Despite Steam’s massive library, users frequently miss out on high-value deals because the platform's discovery algorithms often prioritize popularity over affordability. This forces budget-conscious gamers to navigate multiple third-party sites just to find a fair price.

**The Solution:**
SteamPlus consolidates deals from trusted vendors into a single, streamlined interface. Beyond just savings, we provide features the native Steam client lacks, such as advanced profile statistics, global leaderboards, and enhanced data visualization tools.

<img src=images/SteamPlusHome.png alt="SteamPlus Home"/>

<div style="display: flex; justify-content: space-around;">
  <img src=images/SteamPlusHome.png alt="SteamPlus Home"/>
  <img src=images/SteamPlusProfile.png alt="SteamPlus Profile"/>
</div>

## Tech Stack
*   **Frontend:** React built with **Vite** for optimized performance and fast builds.
*   **Backend:** Node.js & Express API for server-side logic.
*   **Database:** MySQL for persistent storage of user and application data.
*   **Deployment:** Azure Static Web Apps integrated via GitHub Actions CI/CD pipelines.

## Requirements
* Install [Node.JS](https://nodejs.org/en).
* Git installed and configured

## Local Installation

Open a terminal in the `backend` and `frontend` folder and run:

    bash npm install

Run `package.json` dev scripts, backend first:

    nodemon server.js 

and frontend:

    vite

both can be located in the `package.json` scripts.

## Running Locally

Open a terminal in the `backend` folder and run:

    cd backend
    npx nodemon server.js

Open a terminal in the `frontend` folder and run:

    cd frontend
    npm run dev

## Developer Configuration

Access `frontend/src/settings.js` to enable Developer Mode.

## Project Information
Developed by **Group 07** for **CS 330: Intro to Software Engineering**.
* Ethan Horton  
* Yigit Arslan  
* Devon Staley  
* Maddox Schultz  
* Dylan Miller  
