const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const User = require("./models/User");
const Prediction = require("./models/Prediction");

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static("public"));

// ─── DB ───────────────────────────────────────────────────
const MONGO_URI = process.env.MONGO_URI ||
  "mongodb+srv://kirupaanithirr_db_user:Kirupaa%247124@cluster0.sgjyc9z.mongodb.net/cricket_predictor?retryWrites=true&w=majority";

mongoose.connect(MONGO_URI)
  .then(() => console.log("MongoDB Connected ✅"))
  .catch(err => console.log("MongoDB Error:", err));

// ─── ROUTES ───────────────────────────────────────────────

// Create / find user
app.post("/signup", async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: "Name required" });
    let user = await User.findOne({ name });
    if (!user) user = await User.create({ name });
    res.json(user);
  } catch (err) {
    console.error("Signup Error:", err);
    res.status(500).json({ error: "Signup failed" });
  }
});

// Submit a prediction
app.post("/predict", async (req, res) => {
  try {
    const { userId, matchId, prediction, scoreGuess } = req.body;
    // Upsert: one prediction per user per match
    await Prediction.findOneAndUpdate(
      { userId, matchId },
      { prediction, scoreGuess, updatedAt: new Date() },
      { upsert: true, new: true }
    );
    res.json({ message: "Prediction saved ✅" });
  } catch (err) {
    console.error("Predict Error:", err);
    res.status(500).json({ error: "Failed to save prediction" });
  }
});

// Grade results & award points
app.post("/result", async (req, res) => {
  try {
    const { matchId, winner, actualScore } = req.body;
    const predictions = await Prediction.find({ matchId });

    for (const p of predictions) {
      let points = 0;
      if (p.prediction === winner) points += 100;
      if (actualScore && p.scoreGuess) {
        const diff = Math.abs(parseInt(p.scoreGuess) - parseInt(actualScore));
        if (diff <= 5) points += 50;
        else if (diff <= 15) points += 25;
        else if (diff <= 30) points += 10;
      }
      if (points > 0) {
        await User.findByIdAndUpdate(p.userId, { $inc: { points } });
      }
    }

    res.json({ message: `Results graded for match ${matchId}` });
  } catch (err) {
    console.error("Result Error:", err);
    res.status(500).json({ error: "Failed to grade results" });
  }
});

// Leaderboard
app.get("/leaderboard", async (req, res) => {
  try {
    const users = await User.find().sort({ points: -1 }).limit(20);
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch leaderboard" });
  }
});

// User stats
app.get("/user/:id", async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    const preds = await Prediction.find({ userId: req.params.id });
    res.json({ user, predictions: preds });
  } catch (err) {
    res.status(500).json({ error: "User not found" });
  }
});

// ─── START ────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🏏 CricPredict server running on port ${PORT}`));
