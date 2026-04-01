const API = "";
let currentUser = null;

async function api(path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

async function login() {
  try {
    const name = document.getElementById("name").value.trim();
    const isAdmin = document.getElementById("isAdmin").checked;
    currentUser = await api("/signup", { method: "POST", body: JSON.stringify({ name, isAdmin }) });
    document.getElementById("userState").textContent = `Logged in as ${currentUser.name}`;
    await refreshComparison();
  } catch (e) {
    document.getElementById("userState").textContent = e.message;
  }
}

async function loadMatches() {
  const matches = await api("/matches");
  const options = matches.map(m => `<option value="${m._id}">${m.team1} vs ${m.team2} (${new Date(m.startTime).toLocaleString()}) [${m.status}]</option>`).join("");
  document.getElementById("matchSelect").innerHTML = options;
  document.getElementById("adminMatchSelect").innerHTML = options;
}

function getPredictionPayload() {
  return {
    tossWinner: document.getElementById("tossWinner").value.trim(),
    matchWinner: document.getElementById("matchWinner").value.trim(),
    manOfTheMatch: document.getElementById("motm").value.trim(),
    mostWickets: document.getElementById("mostWickets").value.trim(),
    highestRuns: document.getElementById("highestRuns").value.trim(),
    team1Score: Number(document.getElementById("team1Score").value),
    team2Score: Number(document.getElementById("team2Score").value)
  };
}

async function submitPrediction() {
  const msg = document.getElementById("predictMsg");
  try {
    if (!currentUser) throw new Error("Please login first");
    const matchId = document.getElementById("matchSelect").value;
    await api("/predictions", {
      method: "POST",
      body: JSON.stringify({ userId: currentUser._id, matchId, answers: getPredictionPayload() })
    });
    msg.textContent = "Prediction submitted.";
    await refreshComparison();
  } catch (e) {
    msg.textContent = e.message;
  }
}

async function submitResult() {
  const msg = document.getElementById("adminMsg");
  try {
    const matchId = document.getElementById("adminMatchSelect").value;
    const token = document.getElementById("adminToken").value.trim();
    await api(`/admin/results/${matchId}`, {
      method: "POST",
      headers: { "x-admin-token": token },
      body: JSON.stringify({
        actualTossWinner: document.getElementById("actualTossWinner").value.trim(),
        actualMatchWinner: document.getElementById("actualMatchWinner").value.trim(),
        actualManOfTheMatch: document.getElementById("actualMotm").value.trim(),
        actualMostWickets: document.getElementById("actualMostWickets").value.trim(),
        actualHighestRuns: document.getElementById("actualHighestRuns").value.trim(),
        finalTeam1Score: Number(document.getElementById("finalTeam1Score").value),
        finalTeam2Score: Number(document.getElementById("finalTeam2Score").value)
      })
    });
    msg.textContent = "Results saved and evaluations updated.";
    await renderLeaderboard();
    await refreshComparison();
  } catch (e) {
    msg.textContent = e.message;
  }
}

async function finalizeResult() {
  const msg = document.getElementById("adminMsg");
  try {
    const matchId = document.getElementById("adminMatchSelect").value;
    const token = document.getElementById("adminToken").value.trim();
    await api(`/admin/results/${matchId}/finalize`, { method: "POST", headers: { "x-admin-token": token } });
    msg.textContent = "Result finalized.";
  } catch (e) {
    msg.textContent = e.message;
  }
}

async function renderLeaderboard() {
  const users = await api("/leaderboard");
  document.getElementById("leaderboard").innerHTML = users
    .map((u, i) => `<div>${i + 1}. ${u.name} — ${u.points} pts</div>`)
    .join("") || "No users yet.";
}

async function refreshComparison() {
  if (!currentUser) return;
  const matchId = document.getElementById("matchSelect").value;
  if (!matchId) return;
  const [prediction, result] = await Promise.all([
    api(`/matches/${matchId}/predictions/${currentUser._id}`),
    api(`/matches/${matchId}/results`)
  ]);

  if (!prediction) {
    document.getElementById("comparison").textContent = "No prediction submitted for selected match.";
    return;
  }

  const lines = [
    `<div><strong>Your Score:</strong> ${prediction.score || 0}</div>`,
    `<div><strong>Breakdown:</strong> ${JSON.stringify(prediction.scoreBreakdown || {})}</div>`,
    `<div><strong>Your Answers:</strong> ${JSON.stringify(prediction.answers)}</div>`,
    `<div><strong>Actual Results:</strong> ${result ? JSON.stringify(result) : "Not declared"}</div>`
  ];
  document.getElementById("comparison").innerHTML = lines.join("");
}

document.getElementById("matchSelect").addEventListener("change", refreshComparison);

(async function init() {
  await loadMatches();
  await renderLeaderboard();
})();
