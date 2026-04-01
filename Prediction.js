const mongoose = require("mongoose");

const predictionSchema = new mongoose.Schema({
  userId:     { type: String, required: true },
  matchId:    { type: String, required: true },
  prediction: { type: String, required: true },  // winning team name
  scoreGuess: { type: Number, default: null },    // optional score prediction
  type:       { type: String, default: "winner" }, // "winner" | "motm"
  updatedAt:  { type: Date, default: Date.now }
});

predictionSchema.index({ userId: 1, matchId: 1 }, { unique: true });

module.exports = mongoose.model("Prediction", predictionSchema);
