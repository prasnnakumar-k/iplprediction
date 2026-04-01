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
cd /path/to/iplprediction
npm install
npm start
```

Open:
- User: `http://localhost:5000/`
- Admin: `http://localhost:5000/admin`

## Env

- `MONGO_URI` (default: `mongodb://127.0.0.1:27017/cricket_predictor`)
- `ADMIN_TOKEN` (default: `admin-secret`)


> If you get `ENOENT: no such file or directory, open '.../package.json'`, you are running commands outside the project folder. `cd` into the folder that contains `server.js` and `package.json` first.


## One-command data import (teams + players + fixtures)

1) Keep MongoDB running on `127.0.0.1:27017` (or set `MONGO_URI`).
2) Edit `data/ipl-2026.json` with your IPL teams and fixtures (supports nested `teams[].players`).
3) Run:

```bash
npm run import:data
```

You can also import a custom file:

```bash
node scripts/import-fixtures.js /full/path/to/your-file.json
```

JSON format:

```json
{
  "teams": [
    { "name": "Chennai Super Kings", "short": "CSK", "players": ["MS Dhoni", "Ruturaj Gaikwad"] },
    { "name": "Mumbai Indians", "short": "MI", "players": ["Rohit Sharma", "Jasprit Bumrah"] }
  ],
  "fixtures": [
    {
      "matchNumber": 1,
      "date": "2026-04-05",
      "time": "19:30",
      "team1": "Chennai Super Kings",
      "team2": "Mumbai Indians",
      "venue": "Chennai",
      "status": "upcoming"
    }
  ]
}
```

Admin UI token note:
- In `/admin`, enter `admin-secret` unless you changed `ADMIN_TOKEN` in environment.
- Your provided IPL 2026 dataset is committed at `data/ipl-2026.json`.
