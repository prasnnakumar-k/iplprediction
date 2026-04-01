const API = "";
let currentUser = null;
let matchDetails = null;

async function api(path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

function fillSelect(id, options, valueField = "name", labelField = "name") {
  const select = document.getElementById(id);
  select.innerHTML = options.map(o => `<option value="${o[valueField]}">${o[labelField]}</option>`).join("");
}

async function login() {
  try {
    const name = document.getElementById("name").value.trim();
    currentUser = await api("/signup", { method: "POST", body: JSON.stringify({ name }) });
    document.getElementById("userState").textContent = `Logged in as ${currentUser.name}`;
    await refreshPredictionState();
  } catch (e) {
    document.getElementById("userState").textContent = e.message;
  }
}

async function loadMatches() {
  const matches = await api("/matches");
  const predictionOpen = matches.filter(m => m.status === "prediction_open");
  const select = document.getElementById("matchSelect");

  if (!predictionOpen.length) {
    select.innerHTML = "<option>No open matches</option>";
    document.getElementById("predictMsg").textContent = "No upcoming matches open for predictions.";
    return;
  }

  select.innerHTML = predictionOpen
    .map(m => `<option value="${m._id}">${m.team1?.name || "Team 1"} vs ${m.team2?.name || "Team 2"} (${new Date(m.matchDate).toLocaleString()})</option>`)
    .join("");

  await loadMatchDetails();
}

async function loadMatchDetails() {
  const matchId = document.getElementById("matchSelect").value;
  if (!matchId) return;

  const details = await api(`/match/${matchId}`);
  matchDetails = details;

  const teams = details.teams || [];
  const players = details.players || [];

  fillSelect("tossWinner", teams);
  fillSelect("matchWinner", teams);

  if (!players.length) {
    document.getElementById("predictMsg").textContent = "Players are not available for this match yet. Contact admin.";
    ["motm", "highestRuns", "mostWickets"].forEach(id => {
      document.getElementById(id).innerHTML = "<option value=''>No players available</option>";
    });
  } else {
    document.getElementById("predictMsg").textContent = "";
    fillSelect("motm", players);
    fillSelect("highestRuns", players);
    fillSelect("mostWickets", players);
  }

  await refreshPredictionState();
}

function getPredictionPayload() {
  return {
    tossWinner: document.getElementById("tossWinner").value,
    matchWinner: document.getElementById("matchWinner").value,
    manOfTheMatch: document.getElementById("motm").value,
    highestRuns: document.getElementById("highestRuns").value,
    mostWickets: document.getElementById("mostWickets").value,
    team1Score: Number(document.getElementById("team1Score").value),
    team2Score: Number(document.getElementById("team2Score").value)
  };
}

async function submitPrediction() {
  const msg = document.getElementById("predictMsg");
  try {
    if (!currentUser) throw new Error("Please login first");
    if (!matchDetails || matchDetails.match.status !== "prediction_open") {
      throw new Error("This match is not accepting predictions");
    }

    const answers = getPredictionPayload();
    if (Object.values(answers).some(v => v === "" || Number.isNaN(v))) {
      throw new Error("All fields are mandatory");
    }

    await api("/predictions", {
      method: "POST",
      body: JSON.stringify({ userId: currentUser._id, matchId: matchDetails.match._id, answers })
    });

    msg.textContent = "Prediction submitted successfully.";
    await refreshPredictionState();
  } catch (e) {
    msg.textContent = e.message;
  }
}

async function refreshPredictionState() {
  if (!currentUser || !matchDetails) return;
  const prediction = await api(`/matches/${matchDetails.match._id}/predictions/${currentUser._id}`);
  const info = document.getElementById("predictState");

  if (!prediction) {
    info.textContent = "No prediction submitted for selected match.";
    return;
  }

  info.textContent = prediction.evaluatedAt
    ? `Prediction submitted and evaluated. Score: ${prediction.score}`
    : "Prediction submitted. Evaluation pending admin results.";
}

document.getElementById("matchSelect").addEventListener("change", loadMatchDetails);

(async function init() {
  await loadMatches();
})();
