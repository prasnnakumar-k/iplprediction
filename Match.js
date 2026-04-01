const mongoose = require("mongoose");

const matchSchema = new mongoose.Schema({
  team1Id: { type: mongoose.Schema.Types.ObjectId, ref: "Team", required: true, index: true },
  team2Id: { type: mongoose.Schema.Types.ObjectId, ref: "Team", required: true, index: true },
  matchDate: { type: Date, required: true, index: true },
  status: {
    type: String,
    enum: ["prediction_open", "in_progress", "completed"],
    default: "prediction_open",
    index: true
  }
}, { timestamps: true });

module.exports = mongoose.model("Match", matchSchema);
