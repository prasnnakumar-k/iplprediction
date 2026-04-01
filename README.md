# 🏏 CricPredict — Manual IPL Prediction Platform

This refactor removes third-party sports API dependencies and turns the app into a manual workflow:

- Users submit predictions through a mandatory questionnaire.
- Admins manually enter final results.
- The system evaluates predictions and updates leaderboard points.

## Key Capabilities

- **Prediction questionnaire (required fields):**
  - Toss winner
  - Match winner
  - Man of the Match
  - Most wickets player
  - Highest runs player
  - Team 1 and Team 2 score predictions
- **One prediction per user per match** (duplicate submission blocked).
- **Prediction locking** after match start time or non-open status.
- **Admin-only result entry** using `x-admin-token` header.
- **Result finalization** to prevent accidental edits.
- **Evaluation engine** with configurable scoring.
- **Leaderboard aggregation** from stored user points.

## Run

```bash
npm install
node server.js
```

Open: `http://localhost:5000`

## Environment

- `MONGO_URI` (optional, default: `mongodb://127.0.0.1:27017/cricket_predictor`)
- `ADMIN_TOKEN` (optional, default: `admin-secret`)

## API Summary

- `POST /signup`
- `GET /matches`
- `POST /predictions`
- `GET /matches/:matchId/predictions/:userId`
- `POST /admin/results/:matchId` (admin)
- `POST /admin/results/:matchId/finalize` (admin)
- `GET /matches/:matchId/results`
- `GET /leaderboard`

Legacy compatibility endpoints remain:
- `POST /predict`
- `POST /result` (admin)
