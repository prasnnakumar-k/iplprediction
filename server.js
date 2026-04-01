const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const User = require("./User");
const Prediction = require("./Prediction");
const Match = require("./Match");
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

function normalizeText(value = "") {
  return String(value || "").trim().toLowerCase();
}

function adminOnly(req, res, next) {
  const token = req.header("x-admin-token");
  if (token !== ADMIN_TOKEN) {
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
}

function validateAnswers(answers = {}) {
  const required = [
    "tossWinner",
    "matchWinner",
    "manOfTheMatch",
    "mostWickets",
    "highestRuns",
    "team1Score",
    "team2Score"
  ];

  for (const field of required) {
    if (answers[field] === undefined || answers[field] === null || answers[field] === "") {
      return `Missing required field: ${field}`;
    }
  }
  return null;
}

function evaluatePrediction(prediction, result) {
  const breakdown = {
    tossWinner: 0,
    matchWinner: 0,
    manOfTheMatch: 0,
    mostWickets: 0,
    highestRuns: 0,
    team1Score: 0,
    team2Score: 0
  };

  if (normalizeText(prediction.answers.tossWinner) === normalizeText(result.actualTossWinner)) {
    breakdown.tossWinner = scoringConfig.tossWinner;
  }
  if (normalizeText(prediction.answers.matchWinner) === normalizeText(result.actualMatchWinner)) {
    breakdown.matchWinner = scoringConfig.matchWinner;
  }
  if (normalizeText(prediction.answers.manOfTheMatch) === normalizeText(result.actualManOfTheMatch)) {
    breakdown.manOfTheMatch = scoringConfig.manOfTheMatch;
  }
  if (normalizeText(prediction.answers.mostWickets) === normalizeText(result.actualMostWickets)) {
    breakdown.mostWickets = scoringConfig.mostWickets;
  }
  if (normalizeText(prediction.answers.highestRuns) === normalizeText(result.actualHighestRuns)) {
    breakdown.highestRuns = scoringConfig.highestRuns;
  }
  if (Number(prediction.answers.team1Score) === Number(result.finalTeam1Score)) {
    breakdown.team1Score = scoringConfig.team1Score;
  }
  if (Number(prediction.answers.team2Score) === Number(result.finalTeam2Score)) {
    breakdown.team2Score = scoringConfig.team2Score;
  }

  const total = Object.values(breakdown).reduce((a, b) => a + b, 0);
  return { total, breakdown };
}

async function evaluateMatch(matchId) {
  const result = await MatchResult.findOne({ matchId });
  if (!result) return;

  const predictions = await Prediction.find({ matchId });
  for (const prediction of predictions) {
    const prev = prediction.score || 0;
    const evalData = evaluatePrediction(prediction, result);
    prediction.score = evalData.total;
    prediction.scoreBreakdown = evalData.breakdown;
    prediction.evaluatedAt = new Date();
    await prediction.save();

    await User.findByIdAndUpdate(prediction.userId, { $inc: { points: evalData.total - prev } });
  }
}

async function seedMatches() {
  const total = await Match.countDocuments();
  if (total > 0) return;

  const now = Date.now();
  await Match.insertMany([
    {
      series: "IPL 2026",
      team1: "Chennai Super Kings",
      team2: "Mumbai Indians",
      venue: "MA Chidambaram Stadium",
      startTime: new Date(now + 24 * 60 * 60 * 1000)
    },
    {
      series: "IPL 2026",
      team1: "Royal Challengers Bengaluru",
      team2: "Kolkata Knight Riders",
      venue: "M Chinnaswamy Stadium",
      startTime: new Date(now + 48 * 60 * 60 * 1000)
    }
  ]);
}

mongoose.connect(MONGO_URI)
  .then(async () => {
    await seedMatches();
    console.log("MongoDB Connected ✅");
  })
  .catch(err => console.log("MongoDB Error:", err));

app.post("/signup", async (req, res) => {
  try {
    const { name, isAdmin = false } = req.body;
    if (!name) return res.status(400).json({ error: "Name required" });
    let user = await User.findOne({ name: name.trim() });
    if (!user) user = await User.create({ name: name.trim(), isAdmin });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: "Signup failed" });
  }
});

app.get("/matches", async (req, res) => {
  const matches = await Match.find().sort({ startTime: 1 });
  res.json(matches);
});

app.post("/admin/matches", adminOnly, async (req, res) => {
  try {
    const match = await Match.create(req.body);
    res.status(201).json(match);
  } catch (err) {
    res.status(400).json({ error: "Invalid match payload" });
  }
});

app.post("/predictions", async (req, res) => {
  try {
    const { userId, matchId, answers } = req.body;
    const validationError = validateAnswers(answers);
    if (!userId || !matchId || validationError) {
      return res.status(400).json({ error: validationError || "userId and matchId are required" });
    }

    const match = await Match.findById(matchId);
    if (!match) return res.status(404).json({ error: "Match not found" });

    if (new Date(match.startTime) <= new Date() || match.status !== "prediction_open") {
      return res.status(409).json({ error: "Predictions are locked for this match" });
    }

    const existing = await Prediction.findOne({ userId, matchId });
    if (existing) {
      return res.status(409).json({ error: "Prediction already submitted for this match" });
    }

    const prediction = await Prediction.create({ userId, matchId, answers, updatedAt: new Date() });
    res.status(201).json(prediction);
  } catch (err) {
    res.status(500).json({ error: "Failed to save prediction" });
  }
});

app.get("/matches/:matchId/predictions/:userId", async (req, res) => {
  const prediction = await Prediction.findOne({
    matchId: req.params.matchId,
    userId: req.params.userId
  });
  res.json(prediction || null);
});

app.post("/admin/results/:matchId", adminOnly, async (req, res) => {
  try {
    const matchId = req.params.matchId;
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

    if (validationError) {
      return res.status(400).json({ error: validationError.replace("Missing required field: ", "Missing result field: ") });
    }

    const existing = await MatchResult.findOne({ matchId });
    if (existing?.isFinalized && req.query.override !== "true") {
      return res.status(409).json({ error: "Result already finalized. Use override=true to update." });
    }

    const auditEntry = {
      at: new Date(),
      actor: "admin",
      note: req.query.override === "true" ? (req.header("x-override-reason") || "override") : "initial entry"
    };

    const result = await MatchResult.findOneAndUpdate(
      { matchId },
      {
        ...payload,
        $push: { auditLog: auditEntry }
      },
      { upsert: true, new: true }
    );

    await Match.findByIdAndUpdate(matchId, { status: "completed" });
    await evaluateMatch(matchId);

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: "Failed to store results" });
  }
});

app.post("/admin/results/:matchId/finalize", adminOnly, async (req, res) => {
  const result = await MatchResult.findOneAndUpdate(
    { matchId: req.params.matchId },
    { isFinalized: true, finalizedAt: new Date(), $push: { auditLog: { note: "finalized", actor: "admin" } } },
    { new: true }
  );
  if (!result) return res.status(404).json({ error: "Result not found" });
  res.json(result);
});

app.get("/matches/:matchId/results", async (req, res) => {
  const result = await MatchResult.findOne({ matchId: req.params.matchId });
  res.json(result || null);
});

app.get("/leaderboard", async (req, res) => {
  const leaderboard = await User.find().sort({ points: -1, createdAt: 1 }).limit(100).lean();
  res.json(leaderboard);
});

app.get("/user/:id", async (req, res) => {
  try {
    const [user, predictions] = await Promise.all([
      User.findById(req.params.id),
      Prediction.find({ userId: req.params.id }).sort({ createdAt: -1 }).lean()
    ]);
    res.json({ user, predictions });
  } catch {
    res.status(500).json({ error: "User not found" });
  }
});

// backward-compatible wrappers
app.post("/predict", async (req, res) => {
  try {
    const { userId, matchId, prediction, scoreGuess } = req.body;
    const answers = {
      tossWinner: prediction,
      matchWinner: prediction,
      manOfTheMatch: "TBD",
      mostWickets: "TBD",
      highestRuns: "TBD",
      team1Score: Number(scoreGuess || 0),
      team2Score: 0
    };
    const validationError = validateAnswers(answers);
    if (!userId || !matchId || validationError) {
      return res.status(400).json({ error: validationError || "userId and matchId are required" });
    }

    const existing = await Prediction.findOne({ userId, matchId });
    if (existing) return res.status(409).json({ error: "Prediction already submitted for this match" });
    await Prediction.create({ userId, matchId, answers, updatedAt: new Date() });
    res.json({ message: "Prediction saved ✅" });
  } catch {
    res.status(500).json({ error: "Failed to save prediction" });
  }
});

app.post("/result", adminOnly, async (req, res) => {
  try {
    const { matchId, winner, actualScore } = req.body;
    const payload = {
      actualTossWinner: winner,
      actualMatchWinner: winner,
      actualManOfTheMatch: "TBD",
      actualMostWickets: "TBD",
      actualHighestRuns: "TBD",
      finalTeam1Score: Number(actualScore || 0),
      finalTeam2Score: 0
    };
    await MatchResult.findOneAndUpdate({ matchId }, payload, { upsert: true, new: true });
    await evaluateMatch(matchId);
    res.json({ message: `Results graded for match ${matchId}` });
  } catch {
    res.status(500).json({ error: "Failed to grade results" });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🏏 CricPredict server running on port ${PORT}`));
