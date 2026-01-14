const sessions = {};

function getSession(id) {
  if (!sessions[id]) sessions[id] = { step: 0, memory: {} };
  return sessions[id];
}

function resetSession(id) {
  sessions[id] = { step: 0, memory: {} };
}

module.exports = { getSession, resetSession };
