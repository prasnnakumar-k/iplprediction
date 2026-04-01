const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");

const Team = require("../Team");
const Player = require("../Player");
const Match = require("../Match");

const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/cricket_predictor";
const inputPath = process.argv[2] || path.join(__dirname, "../data/ipl-2026.json");

function loadFile(filePath) {
  const full = path.resolve(filePath);
  const raw = fs.readFileSync(full, "utf8");
  return JSON.parse(raw);
}

function normalizeStatus(status = "") {
  if (status === "upcoming") return "prediction_open";
  if (status === "live") return "in_progress";
  if (status === "completed") return "completed";
  return "prediction_open";
}

function parseMatchDate(match) {
  if (match.matchDate) return new Date(match.matchDate);
  if (match.date && match.time) return new Date(`${match.date}T${match.time}:00+05:30`);
  if (match.date) return new Date(`${match.date}T00:00:00+05:30`);
  throw new Error(`Missing match date for fixture ${match.team1} vs ${match.team2}`);
}

async function importData() {
  const payload = loadFile(inputPath);
  const teams = payload.teams || [];

  if (!teams.length) {
    throw new Error("No teams found in JSON. Add at least one team.");
  }

  const explicitPlayers = payload.players || [];
  const derivedPlayers = teams.flatMap(team => (team.players || []).map(name => ({ name, team: team.name })));
  const players = explicitPlayers.length ? explicitPlayers : derivedPlayers;

  const matches = payload.matches || payload.fixtures || [];

  const teamMap = new Map();
  for (const team of teams) {
    const doc = await Team.findOneAndUpdate(
      { name: team.name.trim() },
      { name: team.name.trim(), short: (team.short || "").trim() },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    teamMap.set(doc.name, doc._id);
  }

  let playerCount = 0;
  for (const player of players) {
    const teamId = teamMap.get(player.team);
    if (!teamId) {
      throw new Error(`Player team not found: ${player.team} for player ${player.name}`);
    }

    await Player.findOneAndUpdate(
      { name: player.name.trim(), teamId },
      { name: player.name.trim(), teamId },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    playerCount += 1;
  }

  let matchCount = 0;
  for (const match of matches) {
    const team1Id = teamMap.get(match.team1);
    const team2Id = teamMap.get(match.team2);

    if (!team1Id || !team2Id) {
      throw new Error(`Match team not found for fixture ${match.team1} vs ${match.team2}`);
    }

    const matchDate = parseMatchDate(match);

    await Match.findOneAndUpdate(
      { matchNumber: match.matchNumber || null, team1Id, team2Id, matchDate },
      {
        team1Id,
        team2Id,
        matchDate,
        matchNumber: match.matchNumber || null,
        venue: match.venue || "",
        status: normalizeStatus(match.status)
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    matchCount += 1;
  }

  console.log(`Imported: ${teams.length} teams, ${playerCount} players, ${matchCount} matches.`);
}

(async () => {
  try {
    await mongoose.connect(MONGO_URI);
    await importData();
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error("Import failed:", err.message);
    process.exit(1);
  }
})();
