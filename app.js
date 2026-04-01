/*
 * CricPredict — app.js
 *
 * FREE API: CricAPI (https://cricapi.com)
 *   Sign up FREE at https://cricapi.com → get your API key
 *   Free tier: 100 calls/day
 *   Endpoints used:
 *     /currentMatches  → live + upcoming matches
 *     /cricScore       → live score for a match
 *
 * Fallback: if no API key set, demo data is used so the UI works immediately.
 *
 * Set your key:  const CRIC_API_KEY = "YOUR_KEY_HERE";
 */

const CRIC_API_KEY = ""; // ← Paste your CricAPI key here (free at cricapi.com)
const SERVER_URL = ""; // ← Your backend URL, e.g. "http://localhost:5000" (leave blank for localStorage-only mode)
const REFRESH_INTERVAL = 60000; // 60 seconds

/* ===== STATE ===== */
let currentUser = null;
let predictions = JSON.parse(localStorage.getItem("cp_predictions") || "[]");
let leaderboard = JSON.parse(localStorage.getItem("cp_leaderboard") || "[]");
let matches = [];
let selectedMatch = null;
let selectedWinnerTeam = null;
let selectedMOTMMatch = null;
let selectedPlayer = null;

/* ===== DEMO DATA (shown when no API key) ===== */
const DEMO_MATCHES = [
  {
    id: "ipl_1",
    series: "IPL 2025",
    team1: "Chennai Super Kings",
    team2: "Mumbai Indians",
    shortName1: "CSK",
    shortName2: "MI",
    emoji1: "🦁",
    emoji2: "🦈",
    status: "live",
    score1: "187/4",
    score2: "—",
    overs1: "18.2",
    venue: "MA Chidambaram Stadium, Chennai",
    date: "Today, 7:30 PM IST",
    crr: "10.2",
    rrr: "—"
  },
  {
    id: "ipl_2",
    series: "IPL 2025",
    team1: "Royal Challengers Bangalore",
    team2: "Kolkata Knight Riders",
    shortName1: "RCB",
    shortName2: "KKR",
    emoji1: "🔴",
    emoji2: "💜",
    status: "upcoming",
    score1: "—",
    score2: "—",
    overs1: "—",
    venue: "M. Chinnaswamy Stadium, Bengaluru",
    date: "Tomorrow, 3:30 PM IST",
    crr: "—",
    rrr: "—"
  },
  {
    id: "ipl_3",
    series: "IPL 2025",
    team1: "Rajasthan Royals",
    team2: "Delhi Capitals",
    shortName1: "RR",
    shortName2: "DC",
    emoji1: "🌸",
    emoji2: "🔵",
    status: "upcoming",
    score1: "—",
    score2: "—",
    overs1: "—",
    venue: "Sawai Mansingh Stadium, Jaipur",
    date: "Mar 31, 7:30 PM IST",
    crr: "—",
    rrr: "—"
  },
  {
    id: "ipl_4",
    series: "IPL 2025",
    team1: "Punjab Kings",
    team2: "Sunrisers Hyderabad",
    shortName1: "PBKS",
    shortName2: "SRH",
    emoji1: "🦁",
    emoji2: "🌅",
    status: "completed",
    score1: "201/5",
    score2: "178/9",
    overs1: "20",
    venue: "New PCA Stadium, Mullanpur",
    date: "Mar 29",
    crr: "—",
    rrr: "—",
    result: "Punjab Kings won by 23 runs"
  }
];

const DEMO_PLAYERS = {
  "CSK": [
    { name: "Ruturaj Gaikwad", role: "Batsman", form: ["g","g","g","b","g"] },
    { name: "MS Dhoni", role: "WK-Batter", form: ["g","b","g","g","b"] },
    { name: "Ravindra Jadeja", role: "All-rounder", form: ["g","g","b","g","g"] },
    { name: "Deepak Chahar", role: "Bowler", form: ["b","g","g","g","b"] },
  ],
  "MI": [
    { name: "Rohit Sharma", role: "Batsman", form: ["g","b","g","g","g"] },
    { name: "Suryakumar Yadav", role: "Batsman", form: ["g","g","g","b","g"] },
    { name: "Jasprit Bumrah", role: "Bowler", form: ["g","g","g","g","b"] },
    { name: "Hardik Pandya", role: "All-rounder", form: ["b","g","g","b","g"] },
  ],
  "RCB": [
    { name: "Virat Kohli", role: "Batsman", form: ["g","g","b","g","g"] },
    { name: "Glenn Maxwell", role: "All-rounder", form: ["b","g","g","b","g"] },
    { name: "Faf du Plessis", role: "Batsman", form: ["g","b","g","g","b"] },
  ],
  "KKR": [
    { name: "Shreyas Iyer", role: "Batsman", form: ["g","g","g","b","g"] },
    { name: "Andre Russell", role: "All-rounder", form: ["g","b","g","g","g"] },
    { name: "Sunil Narine", role: "All-rounder", form: ["g","g","b","g","b"] },
  ]
};

/* ===== API HELPERS ===== */
async function fetchLiveMatches() {
  if (!CRIC_API_KEY) return null;
  try {
    const r = await fetch(`https://cricapi.com/api/currentMatches?apikey=${CRIC_API_KEY}`);
    const d = await r.json();
    return d.success ? d.matches : null;
  } catch { return null; }
}

function parseApiMatch(m) {
  const teams = (m.team_1 && m.team_2) ? [m.team_1, m.team_2] : ["Team A", "Team B"];
  return {
    id: m.unique_id || m.id,
    series: m.series || "Cricket",
    team1: teams[0], team2: teams[1],
    shortName1: abbrev(teams[0]), shortName2: abbrev(teams[1]),
    emoji1: teamEmoji(teams[0]), emoji2: teamEmoji(teams[1]),
    status: m.matchStarted ? (m.matchEnded ? "completed" : "live") : "upcoming",
    score1: m.score_team_1 || "—",
    score2: m.score_team_2 || "—",
    overs1: m.overs || "—",
    venue: m.venue || "TBC",
    date: m.date || "",
    result: m.winner_team || "",
    crr: m.curr_rate || "—",
    rrr: m.reqd_rate || "—"
  };
}

function abbrev(name) {
  const map = {
    "Chennai Super Kings": "CSK", "Mumbai Indians": "MI",
    "Royal Challengers Bangalore": "RCB", "Kolkata Knight Riders": "KKR",
    "Rajasthan Royals": "RR", "Delhi Capitals": "DC",
    "Punjab Kings": "PBKS", "Sunrisers Hyderabad": "SRH",
    "Lucknow Super Giants": "LSG", "Gujarat Titans": "GT"
  };
  return map[name] || name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 4);
}

function teamEmoji(name) {
  const map = {
    "Chennai Super Kings": "🦁", "Mumbai Indians": "🦈",
    "Royal Challengers Bangalore": "🔴", "Kolkata Knight Riders": "💜",
    "Rajasthan Royals": "🌸", "Delhi Capitals": "🔵",
    "Punjab Kings": "🔥", "Sunrisers Hyderabad": "🌅",
    "Lucknow Super Giants": "🟢", "Gujarat Titans": "🔷"
  };
  return map[name] || "🏏";
}

/* ===== INIT ===== */
async function init() {
  const saved = localStorage.getItem("cp_user");
  if (saved) {
    currentUser = JSON.parse(saved);
    showUserUI();
  }

  await loadAllMatches();
  renderLeaderboard();
  renderSeriesInfo();

  setInterval(async () => {
    await loadAllMatches();
    renderLeaderboard();
  }, REFRESH_INTERVAL);
}

async function loadAllMatches() {
  const apiData = await fetchLiveMatches();
  if (apiData && apiData.length) {
    matches = apiData.map(parseApiMatch);
  } else {
    matches = DEMO_MATCHES;
  }
  renderLiveBanner();
  renderMatchList();
  renderPredictMatchList();
  renderMOTMMatchList();
}

/* ===== LIVE BANNER ===== */
function renderLiveBanner() {
  const live = matches.find(m => m.status === "live") || matches[0];
  if (!live) { document.getElementById("liveBanner").style.display = "none"; return; }

  const isLive = live.status === "live";
  document.getElementById("liveScoreContent").innerHTML = `
    <div class="match-teams">
      <div class="team-block">
        <div class="team-logo">${live.emoji1}</div>
        <div class="team-name">${live.shortName1}</div>
        <div class="team-score">${live.score1 !== "—" ? live.score1 : ""}</div>
        ${live.overs1 !== "—" ? `<div class="team-overs">${live.overs1} overs</div>` : ""}
      </div>
      <div class="vs-block">
        <div class="vs-text">VS</div>
        <div class="match-meta">${isLive ? "In Progress" : (live.status === "completed" ? "Completed" : "Upcoming")}</div>
      </div>
      <div class="team-block">
        <div class="team-logo">${live.emoji2}</div>
        <div class="team-name">${live.shortName2}</div>
        <div class="team-score">${live.score2 !== "—" ? live.score2 : ""}</div>
      </div>
    </div>
    <div class="match-info-row">
      <div class="match-info-chip"><strong>Series:</strong> ${live.series}</div>
      <div class="match-info-chip"><strong>Venue:</strong> ${live.venue}</div>
      ${live.crr !== "—" ? `<div class="match-info-chip"><strong>CRR:</strong> ${live.crr}</div>` : ""}
      ${live.rrr && live.rrr !== "—" ? `<div class="match-info-chip"><strong>RRR:</strong> ${live.rrr}</div>` : ""}
      ${live.result ? `<div class="match-info-chip" style="color:var(--success)"><strong>Result:</strong> ${live.result}</div>` : ""}
    </div>
  `;

  if (!isLive) {
    document.querySelector(".live-label").textContent = live.status === "completed" ? "Last Match" : "Next Match";
    document.querySelector(".live-label").style.background = "rgba(124,58,237,0.15)";
    document.querySelector(".live-label").style.color = "#a78bfa";
    document.querySelector(".live-label").style.borderColor = "rgba(124,58,237,0.4)";
  }
}

/* ===== MATCH LIST ===== */
function renderMatchList() {
  const container = document.getElementById("matchListContent");
  if (!matches.length) { container.innerHTML = `<p style="color:var(--text-muted);text-align:center;padding:20px">No matches found.</p>`; return; }

  container.innerHTML = matches.map(m => `
    <div class="match-row" onclick="selectMatchForPredict('${m.id}')">
      <div>
        <div class="match-row-teams">${m.shortName1} <span style="color:var(--text-dim)">vs</span> ${m.shortName2}</div>
        <div class="match-row-meta">${m.series} · ${m.venue}</div>
        <div class="match-row-meta" style="margin-top:2px">${m.date}</div>
      </div>
      <div class="match-row-right">
        <span class="badge badge-${m.status}">${m.status === "live" ? "Live" : m.status === "upcoming" ? "Upcoming" : "Completed"}</span>
        ${m.result ? `<div style="font-size:12px;color:var(--success);margin-top:6px">${m.result}</div>` : ""}
        ${m.score1 !== "—" ? `<div style="font-size:13px;font-weight:600;margin-top:4px">${m.score1}${m.score2 !== "—" ? " / " + m.score2 : ""}</div>` : ""}
      </div>
    </div>
  `).join("");
}

/* ===== PREDICT TAB ===== */
function renderPredictMatchList() {
  const container = document.getElementById("predictMatchList");
  const upcoming = matches.filter(m => m.status !== "completed");
  container.innerHTML = upcoming.map(m => `
    <div class="match-row ${selectedMatch && selectedMatch.id === m.id ? 'active' : ''}" onclick="openScorePredictor('${m.id}')">
      <div>
        <div class="match-row-teams">${m.shortName1} vs ${m.shortName2}</div>
        <div class="match-row-meta">${m.series} · ${m.date}</div>
      </div>
      <span class="badge badge-${m.status}">${m.status === "live" ? "Live" : "Upcoming"}</span>
    </div>
  `).join("") || `<p style="color:var(--text-muted);text-align:center;padding:20px">No upcoming matches.</p>`;
}

function openScorePredictor(matchId) {
  selectedMatch = matches.find(m => m.id === matchId);
  if (!selectedMatch) return;
  selectedWinnerTeam = null;

  document.getElementById("predictMatchTitle").textContent = `${selectedMatch.shortName1} vs ${selectedMatch.shortName2}`;
  document.getElementById("team1Name").textContent = selectedMatch.shortName1;
  document.getElementById("team2Name").textContent = selectedMatch.shortName2;
  document.getElementById("team1Btn").className = "predict-btn";
  document.getElementById("team2Btn").className = "predict-btn";
  document.getElementById("scoreGuess").value = "";
  document.getElementById("predSuccess").style.display = "none";
  document.getElementById("scorePredictor").style.display = "block";
  renderPredictMatchList();
}

function selectWinner(team) {
  selectedWinnerTeam = team;
  document.getElementById("team1Btn").className = "predict-btn" + (team === "team1" ? " selected" : "");
  document.getElementById("team2Btn").className = "predict-btn" + (team === "team2" ? " selected" : "");
}

function submitPrediction() {
  if (!currentUser) { showToast("Please join first!", "error"); document.getElementById("loginModal").style.display = "flex"; return; }
  if (!selectedMatch) { showToast("Select a match first", "error"); return; }
  if (!selectedWinnerTeam) { showToast("Pick a winner!", "error"); return; }

  const winnerName = selectedWinnerTeam === "team1" ? selectedMatch.shortName1 : selectedMatch.shortName2;
  const scoreGuess = document.getElementById("scoreGuess").value;

  const pred = {
    matchId: selectedMatch.id,
    matchName: `${selectedMatch.shortName1} vs ${selectedMatch.shortName2}`,
    winner: winnerName,
    scoreGuess: scoreGuess || null,
    timestamp: new Date().toISOString(),
    userId: currentUser.id
  };

  predictions = predictions.filter(p => !(p.matchId === pred.matchId && p.userId === pred.userId));
  predictions.push(pred);
  localStorage.setItem("cp_predictions", JSON.stringify(predictions));

  if (SERVER_URL) savePredictionToServer(pred);

  document.getElementById("predSuccess").style.display = "block";
  showToast(`Prediction saved: ${winnerName} to win!`, "success");
  renderMyPredictions();
}

async function savePredictionToServer(pred) {
  try {
    await fetch(`${SERVER_URL}/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: pred.userId, matchId: pred.matchId, prediction: pred.winner })
    });
  } catch(e) { console.warn("Server save failed:", e); }
}

/* ===== MOTM TAB ===== */
function renderMOTMMatchList() {
  const container = document.getElementById("motmMatchSelector");
  const upcoming = matches.filter(m => m.status !== "completed");
  container.innerHTML = upcoming.map(m => `
    <div class="match-row ${selectedMOTMMatch && selectedMOTMMatch.id === m.id ? 'active' : ''}" onclick="openMOTMPredict('${m.id}')">
      <div>
        <div class="match-row-teams">${m.shortName1} vs ${m.shortName2}</div>
        <div class="match-row-meta">${m.series} · ${m.date}</div>
      </div>
      <span class="badge badge-${m.status}">${m.status === "live" ? "Live" : "Upcoming"}</span>
    </div>
  `).join("");
}

function openMOTMPredict(matchId) {
  selectedMOTMMatch = matches.find(m => m.id === matchId);
  if (!selectedMOTMMatch) return;
  selectedPlayer = null;

  const players1 = DEMO_PLAYERS[selectedMOTMMatch.shortName1] || getGenericPlayers(selectedMOTMMatch.team1);
  const players2 = DEMO_PLAYERS[selectedMOTMMatch.shortName2] || getGenericPlayers(selectedMOTMMatch.team2);
  const allPlayers = [
    ...players1.map(p => ({...p, team: selectedMOTMMatch.shortName1})),
    ...players2.map(p => ({...p, team: selectedMOTMMatch.shortName2}))
  ];

  document.getElementById("motmPlayers").style.display = "block";
  document.getElementById("motmSuccess").style.display = "none";
  document.getElementById("playerGrid").innerHTML = allPlayers.map((p, i) => `
    <div class="player-card" id="pc_${i}" onclick="selectPlayerCard(${i}, '${p.name}')">
      <div class="player-avatar">${p.team[0]}</div>
      <div class="player-name">${p.name}</div>
      <div class="player-team">${p.team} · ${p.role}</div>
      <div class="player-form">
        ${(p.form || ["b","b","g","g","b"]).map(f => `<div class="form-dot" style="background:${f==="g"?"var(--success)":"var(--danger)"}"></div>`).join("")}
      </div>
    </div>
  `).join("");

  renderMOTMMatchList();
}

function getGenericPlayers(teamName) {
  return [
    { name: "Player 1", role: "Batsman", form: ["g","g","b","g","g"] },
    { name: "Player 2", role: "Bowler", form: ["b","g","g","g","b"] },
    { name: "Player 3", role: "All-rounder", form: ["g","b","g","b","g"] },
  ];
}

function selectPlayerCard(idx, name) {
  selectedPlayer = name;
  document.querySelectorAll(".player-card").forEach((el, i) => {
    el.classList.toggle("selected", i === idx);
  });
}

function submitMOTM() {
  if (!currentUser) { showToast("Please join first!", "error"); document.getElementById("loginModal").style.display="flex"; return; }
  if (!selectedPlayer) { showToast("Select a player first!", "error"); return; }

  const motmPred = {
    type: "motm",
    matchId: selectedMOTMMatch.id,
    matchName: `${selectedMOTMMatch.shortName1} vs ${selectedMOTMMatch.shortName2}`,
    player: selectedPlayer,
    timestamp: new Date().toISOString(),
    userId: currentUser.id
  };

  const motmPreds = JSON.parse(localStorage.getItem("cp_motm") || "[]");
  const updated = motmPreds.filter(p => !(p.matchId === motmPred.matchId && p.userId === motmPred.userId));
  updated.push(motmPred);
  localStorage.setItem("cp_motm", JSON.stringify(updated));

  document.getElementById("motmSuccess").style.display = "block";
  showToast(`MOTM pick saved: ${selectedPlayer}!`, "success");
}

/* ===== USER / AUTH ===== */
async function joinGame() {
  const name = document.getElementById("loginName").value.trim();
  if (!name) { showToast("Please enter your name", "error"); return; }

  let userId;
  if (SERVER_URL) {
    try {
      const r = await fetch(`${SERVER_URL}/signup`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name })
      });
      const d = await r.json();
      userId = d._id;
    } catch { userId = "local_" + Date.now(); }
  } else {
    userId = "local_" + Date.now();
  }

  currentUser = { id: userId, name, points: 0 };
  localStorage.setItem("cp_user", JSON.stringify(currentUser));

  leaderboard = leaderboard.filter(u => u.id !== userId);
  leaderboard.push({ ...currentUser });
  leaderboard.sort((a,b) => b.points - a.points);
  localStorage.setItem("cp_leaderboard", JSON.stringify(leaderboard));

  showUserUI();
  document.getElementById("loginModal").style.display = "none";
  showToast(`Welcome, ${name}! 🏏 Start predicting!`, "success");
  renderMyPredictions();
  renderLeaderboard();
}

function showUserUI() {
  document.getElementById("userChip").style.display = "flex";
  document.getElementById("loginBtn").style.display = "none";
  document.getElementById("userNameDisplay").textContent = currentUser.name;
  document.getElementById("userPointsDisplay").textContent = `${currentUser.points} pts`;
  document.getElementById("myPredCard").style.display = "block";
  renderMyPredictions();
}

/* ===== MY PREDICTIONS ===== */
function renderMyPredictions() {
  if (!currentUser) return;
  const myPreds = predictions.filter(p => p.userId === currentUser.id);
  const motmPreds = JSON.parse(localStorage.getItem("cp_motm") || "[]").filter(p => p.userId === currentUser.id);
  const all = [...myPreds, ...motmPreds];

  document.getElementById("predCount").textContent = all.length;

  if (!all.length) {
    document.getElementById("myPredList").innerHTML = `<p style="color:var(--text-muted);font-size:14px;text-align:center;padding:8px 0">No predictions yet. Start predicting!</p>`;
    return;
  }

  document.getElementById("myPredList").innerHTML = all.map(p => `
    <div style="padding:10px 0;border-bottom:1px solid var(--border);font-size:13px">
      <div style="font-weight:600">${p.matchName}</div>
      <div style="color:var(--text-muted);margin-top:2px">
        ${p.type === "motm" ? `⭐ MOTM: ${p.player}` : `🏆 Winner: ${p.winner}${p.scoreGuess ? ` · Score: ${p.scoreGuess}` : ""}`}
      </div>
    </div>
  `).join("");
}

/* ===== LEADERBOARD ===== */
function renderLeaderboard() {
  const container = document.getElementById("leaderboardContent");

  if (SERVER_URL) {
    fetch(`${SERVER_URL}/leaderboard`)
      .then(r => r.json())
      .then(users => {
        const rows = users.slice(0, 8).map((u, i) => buildLBRow(u.name, u.points, i+1)).join("");
        container.innerHTML = rows || emptyLB();
      })
      .catch(() => renderLocalLeaderboard(container));
  } else {
    renderLocalLeaderboard(container);
  }
}

function renderLocalLeaderboard(container) {
  const rows = leaderboard.slice(0, 8).map((u, i) => buildLBRow(u.name, u.points, i+1)).join("");
  container.innerHTML = rows || emptyLB();
}

function emptyLB() {
  return `<p style="color:var(--text-muted);text-align:center;padding:16px;font-size:14px">Be the first to join and predict!</p>`;
}

function buildLBRow(name, points, rank) {
  const initials = name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0,2);
  return `
    <div class="leaderboard-row">
      <div class="rank ${rank <= 3 ? 'top' : ''}">${rank <= 3 ? ["🥇","🥈","🥉"][rank-1] : rank}</div>
      <div class="lb-avatar">${initials}</div>
      <div class="lb-name">${name}</div>
      <div class="lb-points">${points}</div>
    </div>
  `;
}

/* ===== SERIES INFO ===== */
function renderSeriesInfo() {
  document.getElementById("seriesInfo").innerHTML = `
    <div style="margin-bottom:8px"><strong style="color:var(--text)">IPL 2025</strong></div>
    <div>Matches played: <strong style="color:var(--text)">12 / 74</strong></div>
    <div>Current leader: <strong style="color:var(--accent)">CSK</strong></div>
    <div style="margin-top:12px;margin-bottom:4px;font-weight:600;color:var(--text)">Upcoming series</div>
    <div>ICC World Test Championship (Jun 2025)</div>
    <div>ICC T20 World Cup (Oct 2026)</div>
  `;
}

/* ===== TABS ===== */
function switchTab(tab, el) {
  ["matches","predict","motm"].forEach(t => {
    document.getElementById("tab-"+t).style.display = t === tab ? "block" : "none";
  });
  document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
  el.classList.add("active");
}

function selectMatchForPredict(matchId) {
  switchTab("predict", document.querySelectorAll(".tab")[1]);
  openScorePredictor(matchId);
}

/* ===== TOAST ===== */
function showToast(msg, type = "success") {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.className = `show ${type}`;
  setTimeout(() => { t.className = ""; }, 3000);
}

/* ===== START ===== */
window.addEventListener("DOMContentLoaded", init);
