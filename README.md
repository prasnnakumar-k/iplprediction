# 🏏 CricPredict — Role-Separated IPL Prediction Platform

## What this version enforces

- **User UI (`/`)**: prediction-only flow.
- **Admin UI (`/admin`)**: isolated result-entry and finalization controls.
- **No admin fields on public page**.
- **No third-party sports APIs**; data is manually managed.

## Data Model

- **Teams**: `id`, `name`
- **Players**: `id`, `name`, `teamId`
- **Matches**: `id`, `team1Id`, `team2Id`, `matchDate`, `status`
- **Predictions**: `userId`, `matchId`, questionnaire answers, score, breakdown
- **MatchResult**: admin-entered ground truth + finalization/audit metadata

## Dynamic Prediction Behavior

`GET /match/:id` returns:

```json
{
  "match": {},
  "teams": [],
  "players": []
}
```

The user form dynamically limits:
- Toss winner/match winner → only the two match teams
- MOTM/top scorer/top wicket taker → only players from those teams

## Security and Validation

- Admin APIs require `x-admin-token`
- Prediction blocked after match start or when not `prediction_open`
- Duplicate prediction per user/match prevented
- Invalid team/player selections rejected
- Result overwrite blocked unless `force=true`

## Endpoints

### User
- `POST /signup`
- `GET /matches`
- `GET /match/:id`
- `POST /predictions`
- `GET /matches/:matchId/predictions/:userId`
- `GET /leaderboard`

### Admin
- `POST /admin/teams`
- `POST /admin/players`
- `POST /admin/matches`
- `POST /admin/match-result`
- `PUT /admin/finalize-result`

## Run

```bash
npm install
node server.js
```

Open:
- User: `http://localhost:5000/`
- Admin: `http://localhost:5000/admin`

## Env

- `MONGO_URI` (default: `mongodb://127.0.0.1:27017/cricket_predictor`)
- `ADMIN_TOKEN` (default: `admin-secret`)
