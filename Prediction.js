const mongoose = require("mongoose");

const answerSchema = new mongoose.Schema(
  {
    tossWinner: { type: String, required: true, trim: true },
    matchWinner: { type: String, required: true, trim: true },
    manOfTheMatch: { type: String, required: true, trim: true },
    mostWickets: { type: String, required: true, trim: true },
    highestRuns: { type: String, required: true, trim: true },
    team1Score: { type: Number, required: true, min: 0 },
    team2Score: { type: Number, required: true, min: 0 }
  },
  { _id: false }
);

const predictionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  matchId: { type: mongoose.Schema.Types.ObjectId, ref: "Match", required: true, index: true },
  answers: { type: answerSchema, required: true },
  score: { type: Number, default: 0 },
  scoreBreakdown: { type: Object, default: {} },
  evaluatedAt: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

predictionSchema.index({ userId: 1, matchId: 1 }, { unique: true });

module.exports = mongoose.model("Prediction", predictionSchema);
