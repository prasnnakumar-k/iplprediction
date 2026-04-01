const mongoose = require("mongoose");

const playerSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  teamId: { type: mongoose.Schema.Types.ObjectId, ref: "Team", required: true, index: true }
}, { timestamps: true });

playerSchema.index({ name: 1, teamId: 1 }, { unique: true });

module.exports = mongoose.model("Player", playerSchema);
