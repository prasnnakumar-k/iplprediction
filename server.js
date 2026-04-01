const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const User = require("./User");
const Team = require("./Team");
const Player = require("./Player");
const Match = require("./Match");
const Prediction = require("./Prediction");
const MatchResult = require("./MatchResult");

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static("."));

const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/cricket_predictor";
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "admin-secret";

const scoringConfig = {
  tossWinner: 1,
  matchWinner: 2,
  manOfTheMatch: 3,
  mostWickets: 2,
  highestRuns: 2,
  team1Score: 2,
  team2Score: 2
};

const matchPlayerCache = new Map();

function normalizeText(value = "") {
  return String(value || "").trim().toLowerCase();
}

function adminOnly(req, res, next) {
  if (req.header("x-admin-token") !== ADMIN_TOKEN) {
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
}

function validateAnswers(answers = {}) {
  const required = ["tossWinner", "matchWinner", "manOfTheMatch", "mostWickets", "highestRuns", "team1Score", "team2Score"];
  for (const field of required) {
    if (answers[field] === undefined || answers[field] === null || answers[field] === "") {
      return `Missing required field: ${field}`;
    }
  }
  return null;
}

function isValidPlayerSelection(playerName, players) {
  return players.some(p => normalizeText(p.name) === normalizeText(playerName));
}

function evaluatePrediction(prediction, result) {
  const breakdown = { tossWinner: 0, matchWinner: 0, manOfTheMatch: 0, mostWickets: 0, highestRuns: 0, team1Score: 0, team2Score: 0 };
  if (normalizeText(prediction.answers.tossWinner) === normalizeText(result.actualTossWinner)) breakdown.tossWinner = scoringConfig.tossWinner;
  if (normalizeText(prediction.answers.matchWinner) === normalizeText(result.actualMatchWinner)) breakdown.matchWinner = scoringConfig.matchWinner;
  if (normalizeText(prediction.answers.manOfTheMatch) === normalizeText(result.actualManOfTheMatch)) breakdown.manOfTheMatch = scoringConfig.manOfTheMatch;
  if (normalizeText(prediction.answers.mostWickets) === normalizeText(result.actualMostWickets)) breakdown.mostWickets = scoringConfig.mostWickets;
  if (normalizeText(prediction.answers.highestRuns) === normalizeText(result.actualHighestRuns)) breakdown.highestRuns = scoringConfig.highestRuns;
  if (Number(prediction.answers.team1Score) === Number(result.finalTeam1Score)) breakdown.team1Score = scoringConfig.team1Score;
  if (Number(prediction.answers.team2Score) === Number(result.finalTeam2Score)) breakdown.team2Score = scoringConfig.team2Score;

  return { total: Object.values(breakdown).reduce((a, b) => a + b, 0), breakdown };
}

async function hydrateMatch(matchId) {
  const match = await Match.findById(matchId).lean();
  if (!match) return null;

  const [team1, team2] = await Promise.all([
    Team.findById(match.team1Id).lean(),
    Team.findById(match.team2Id).lean()
  ]);

  const key = String(matchId);
  let players = matchPlayerCache.get(key);
  if (!players) {
    players = await Player.find({ teamId: { $in: [match.team1Id, match.team2Id] } }).lean();
    matchPlayerCache.set(key, players);
  }

  return { match, teams: [team1, team2].filter(Boolean), players };
}

async function evaluateMatch(matchId) {
  const result = await MatchResult.findOne({ matchId });
  if (!result) return;

  const predictions = await Prediction.find({ matchId });
  for (const prediction of predictions) {
    const prev = prediction.score || 0;
    const next = evaluatePrediction(prediction, result);
    prediction.score = next.total;
    prediction.scoreBreakdown = next.breakdown;
    prediction.evaluatedAt = new Date();
    await prediction.save();

    await User.findByIdAndUpdate(prediction.userId, { $inc: { points: next.total - prev } });
  }
}

async function seedData() {
  const teamCount = await Team.countDocuments();
  if (!teamCount) {
    await Team.insertMany([
      { name: "Chennai Super Kings" },
      { name: "Mumbai Indians" },
      { name: "Royal Challengers Bengaluru" },
      { name: "Kolkata Knight Riders" }
    ]);
  }

  const teams = await Team.find().lean();
  const byName = Object.fromEntries(teams.map(t => [t.name, t]));

  const playerCount = await Player.countDocuments();
  if (!playerCount && byName["Chennai Super Kings"] && byName["Mumbai Indians"]) {
    await Player.insertMany([
      { name: "MS Dhoni", teamId: byName["Chennai Super Kings"]._id },
      { name: "Ruturaj Gaikwad", teamId: byName["Chennai Super Kings"]._id },
      { name: "Ravindra Jadeja", teamId: byName["Chennai Super Kings"]._id },
      { name: "Rohit Sharma", teamId: byName["Mumbai Indians"]._id },
      { name: "Jasprit Bumrah", teamId: byName["Mumbai Indians"]._id },
      { name: "Suryakumar Yadav", teamId: byName["Mumbai Indians"]._id }
    ]);
  }

  const matchCount = await Match.countDocuments();
  if (!matchCount && byName["Chennai Super Kings"] && byName["Mumbai Indians"]) {
    await Match.insertMany([
      {
        team1Id: byName["Chennai Super Kings"]._id,
        team2Id: byName["Mumbai Indians"]._id,
        matchDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
        status: "prediction_open"
      }
    ]);
  }
}

mongoose.connect(MONGO_URI)
  .then(async () => {
    await seedData();
    console.log("MongoDB Connected ✅");
  })
  .catch(err => console.log("MongoDB Error:", err));


app.get("/admin", (_req, res) => {
  res.sendFile(require("path").join(__dirname, "admin.html"));
});

app.post("/signup", async (req, res) => {
  try {
    const { name, isAdmin = false } = req.body;
    if (!name) return res.status(400).json({ error: "Name required" });
    let user = await User.findOne({ name: name.trim() });
    if (!user) user = await User.create({ name: name.trim() });
    res.json(user);
  } catch {
    res.status(500).json({ error: "Signup failed" });
  }
});

app.get("/matches", async (_req, res) => {
  const matches = await Match.find().sort({ matchDate: 1 }).lean();
  const teamIds = [...new Set(matches.flatMap(m => [String(m.team1Id), String(m.team2Id)]))];
  const teams = await Team.find({ _id: { $in: teamIds } }).lean();
  const map = Object.fromEntries(teams.map(t => [String(t._id), t]));
  res.json(matches.map(m => ({
    ...m,
    team1: map[String(m.team1Id)] || null,
    team2: map[String(m.team2Id)] || null
  })));
});

app.get("/match/:id", async (req, res) => {
  const hydrated = await hydrateMatch(req.params.id);
  if (!hydrated) return res.status(404).json({ error: "Match not found" });
  res.json(hydrated);
});

app.post("/predictions", async (req, res) => {
  try {
    const { userId, matchId, answers } = req.body;
    const validationError = validateAnswers(answers);
    if (!userId || !matchId || validationError) {
      return res.status(400).json({ error: validationError || "userId and matchId are required" });
    }

    const hydrated = await hydrateMatch(matchId);
    if (!hydrated) return res.status(404).json({ error: "Match not found" });

    if (new Date(hydrated.match.matchDate) <= new Date() || hydrated.match.status !== "prediction_open") {
      return res.status(409).json({ error: "Predictions are locked for this match" });
    }

    if (!isValidPlayerSelection(answers.manOfTheMatch, hydrated.players) ||
        !isValidPlayerSelection(answers.mostWickets, hydrated.players) ||
        !isValidPlayerSelection(answers.highestRuns, hydrated.players)) {
      return res.status(400).json({ error: "Invalid player selection for this match" });
    }

    const validTeams = hydrated.teams.map(t => normalizeText(t.name));
    if (!validTeams.includes(normalizeText(answers.tossWinner)) || !validTeams.includes(normalizeText(answers.matchWinner))) {
      return res.status(400).json({ error: "Team selections must match participating teams" });
    }

    const existing = await Prediction.findOne({ userId, matchId });
    if (existing) return res.status(409).json({ error: "Prediction already submitted for this match" });

    const prediction = await Prediction.create({ userId, matchId, answers, updatedAt: new Date() });
    res.status(201).json(prediction);
  } catch {
    res.status(500).json({ error: "Failed to save prediction" });
  }
});

app.get("/matches/:matchId/predictions/:userId", async (req, res) => {
  const prediction = await Prediction.findOne({ matchId: req.params.matchId, userId: req.params.userId });
  res.json(prediction || null);
});

app.post("/admin/teams", adminOnly, async (req, res) => {
  const team = await Team.create({ name: req.body.name });
  res.status(201).json(team);
});

app.post("/admin/players", adminOnly, async (req, res) => {
  const player = await Player.create({ name: req.body.name, teamId: req.body.teamId });
  matchPlayerCache.clear();
  res.status(201).json(player);
});

app.post("/admin/matches", adminOnly, async (req, res) => {
  const match = await Match.create(req.body);
  res.status(201).json(match);
});

app.post("/admin/match-result", adminOnly, async (req, res) => {
  try {
    const { matchId, force = false } = req.body;
    const payload = req.body;
    const validationError = validateAnswers({
      tossWinner: payload.actualTossWinner,
      matchWinner: payload.actualMatchWinner,
      manOfTheMatch: payload.actualManOfTheMatch,
      mostWickets: payload.actualMostWickets,
      highestRuns: payload.actualHighestRuns,
      team1Score: payload.finalTeam1Score,
      team2Score: payload.finalTeam2Score
    });
    if (!matchId || validationError) return res.status(400).json({ error: validationError || "matchId is required" });

    const existing = await MatchResult.findOne({ matchId });
    if (existing && !force) {
      return res.status(409).json({ error: "Result already exists. Use force=true to overwrite." });
    }

    const result = await MatchResult.findOneAndUpdate(
      { matchId },
      {
        ...payload,
        $push: {
          auditLog: {
            at: new Date(),
            actor: "admin",
            note: existing ? "forced overwrite" : "initial entry"
          }
        }
      },
      { upsert: true, new: true }
    );

    await Match.findByIdAndUpdate(matchId, { status: "completed" });
    await evaluateMatch(matchId);
    res.json(result);
  } catch {
    res.status(500).json({ error: "Failed to store result" });
  }
});

app.put("/admin/finalize-result", adminOnly, async (req, res) => {
  const { matchId } = req.body;
  const result = await MatchResult.findOneAndUpdate(
    { matchId },
    { isFinalized: true, finalizedAt: new Date(), $push: { auditLog: { at: new Date(), actor: "admin", note: "finalized" } } },
    { new: true }
  );
  if (!result) return res.status(404).json({ error: "Result not found" });
  res.json(result);
});

app.get("/matches/:matchId/results", async (req, res) => {
  const result = await MatchResult.findOne({ matchId: req.params.matchId }).lean();
  res.json(result || null);
});

app.get("/leaderboard", async (_req, res) => {
  const leaderboard = await User.find().sort({ points: -1, createdAt: 1 }).limit(100);
  res.json(leaderboard);
});

// compatibility endpoints
app.post("/predict", async (req, res) => res.status(410).json({ error: "Use /predictions with questionnaire answers" }));
app.post("/result", adminOnly, async (req, res) => res.status(410).json({ error: "Use /admin/match-result" }));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🏏 CricPredict server running on port ${PORT}`));
