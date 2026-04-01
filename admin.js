const API = "";

async function api(path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

async function loadMatches() {
  const matches = await api('/matches');
  document.getElementById('matchSelect').innerHTML = matches
    .map(m => `<option value="${m._id}">${m.team1?.name || 'Team 1'} vs ${m.team2?.name || 'Team 2'}</option>`)
    .join('');
}

function adminHeaders() {
  return { 'x-admin-token': document.getElementById('token').value.trim() };
}

async function submitResult() {
  try {
    const payload = {
      matchId: document.getElementById('matchSelect').value,
      actualTossWinner: document.getElementById('actualTossWinner').value.trim(),
      actualMatchWinner: document.getElementById('actualMatchWinner').value.trim(),
      actualManOfTheMatch: document.getElementById('actualManOfTheMatch').value.trim(),
      actualHighestRuns: document.getElementById('actualHighestRuns').value.trim(),
      actualMostWickets: document.getElementById('actualMostWickets').value.trim(),
      finalTeam1Score: Number(document.getElementById('finalTeam1Score').value),
      finalTeam2Score: Number(document.getElementById('finalTeam2Score').value)
    };
    await api('/admin/match-result', { method: 'POST', headers: adminHeaders(), body: JSON.stringify(payload) });
    document.getElementById('message').textContent = 'Result saved and evaluated.';
  } catch (e) {
    document.getElementById('message').textContent = e.message;
  }
}

async function finalizeResult() {
  try {
    await api('/admin/finalize-result', {
      method: 'PUT',
      headers: adminHeaders(),
      body: JSON.stringify({ matchId: document.getElementById('matchSelect').value })
    });
    document.getElementById('message').textContent = 'Result finalized.';
  } catch (e) {
    document.getElementById('message').textContent = e.message;
  }
}

loadMatches();
