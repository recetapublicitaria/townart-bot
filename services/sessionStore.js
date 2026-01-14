const sessions = {};

function getSession(id) {
  if (!sessions[id]) sessions[id] = { step: 0, data: {} };
  return sessions[id];
}

function clearSession(id) {
  sessions[id] = { step: 0, data: {} };
}

module.exports = { getSession, clearSession };
