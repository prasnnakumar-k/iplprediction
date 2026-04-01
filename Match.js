const mongoose = require("mongoose");

const matchSchema = new mongoose.Schema({
  series: { type: String, required: true, trim: true },
  team1: { type: String, required: true, trim: true },
  team2: { type: String, required: true, trim: true },
  venue: { type: String, default: "TBD" },
  startTime: { type: Date, required: true },
  status: {
    type: String,
    enum: ["prediction_open", "in_progress", "completed"],
    default: "prediction_open"
  }
});

module.exports = mongoose.model("Match", matchSchema);
