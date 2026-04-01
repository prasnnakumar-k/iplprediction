# 🏏 CricPredict — IPL & Cricket Prediction App

A beautiful, real-time cricket prediction site supporting IPL, World Cup, and Test series.

---

## Features
- 🔴 **Live scores** — real-time match data via CricAPI (free)
- 🎯 **Score prediction** — predict the match winner + first-innings score
- ⭐ **Man of the Match** — pick your star player before the game
- 🏆 **Leaderboard** — points system: 100 pts for correct winner, 50 pts for score within 5 runs
- 💾 **Works offline too** — localStorage fallback when no server running
- 🔄 **Auto-refreshes** every 60 seconds

---

## Quick Start

### 1. Install & run the backend
```bash
npm install
node server.js
# → Server running on port 5000
# → MongoDB Connected ✅
```

### 2. Get a FREE cricket API key
1. Go to **https://cricapi.com** → Sign up (free)
2. Copy your API key
3. Open `public/app.js` and paste it:
```js
const CRIC_API_KEY = "your_key_here";
```

### 3. Connect frontend to backend (optional)
In `public/app.js`:
```js
const SERVER_URL = "http://localhost:5000";
```

### 4. Open in browser
Visit `http://localhost:5000`

---

## Free API Options
| API | Free Tier | Best For |
|-----|-----------|---------|
| **CricAPI** (cricapi.com) | 100 calls/day | IPL live scores |
| **CricketData** (cricketdata.org) | 100 calls/day | All formats |
| **Rapid API — Cricket Live Line** | Free tier available | More data |

---

## Points System
| Prediction | Points |
|-----------|--------|
| Correct match winner | 100 pts |
| Score within ±5 runs | 50 pts |
| Score within ±15 runs | 25 pts |
| Score within ±30 runs | 10 pts |
| Correct MOTM | 75 pts |

---

## Project Structure
```
cricket-predictor/
├── public/
│   ├── index.html     ← Beautiful dark UI
│   └── app.js         ← All frontend logic + API integration
├── models/
│   ├── User.js
│   └── Prediction.js
├── server.js          ← Express + MongoDB backend
└── package.json
```

---

## Future Roadmap
- [ ] ICC World Cup 2026 predictions
- [ ] Test series multi-day predictions
- [ ] Fantasy squad builder
- [ ] Push notifications for match start
- [ ] Social sharing of predictions
