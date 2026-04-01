const mongoose = require("mongoose");

const matchResultSchema = new mongoose.Schema({
  matchId: { type: mongoose.Schema.Types.ObjectId, ref: "Match", required: true, unique: true },
  actualTossWinner: { type: String, required: true, trim: true },
  actualMatchWinner: { type: String, required: true, trim: true },
  actualManOfTheMatch: { type: String, required: true, trim: true },
  actualMostWickets: { type: String, required: true, trim: true },
  actualHighestRuns: { type: String, required: true, trim: true },
  finalTeam1Score: { type: Number, required: true, min: 0 },
  finalTeam2Score: { type: Number, required: true, min: 0 },
  isFinalized: { type: Boolean, default: false },
  finalizedAt: { type: Date, default: null },
  auditLog: {
    type: [
      {
        at: { type: Date, default: Date.now },
        actor: { type: String, default: "admin" },
        note: { type: String, default: "" }
      }
    ],
    default: []
  }
}, { timestamps: true });

module.exports = mongoose.model("MatchResult", matchResultSchema);
