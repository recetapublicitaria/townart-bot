const sessions = {};

function getSession(userId) {
  if (!sessions[userId]) {
    sessions[userId] = {
      name: null,
      flowActive: false,
      area: null,
      service: null,
      date: null,
      hour: null,
      dayName: null,
      context: {}
    };
  }
  return sessions[userId];
}

function updateSession(userId, data) {
  if (!sessions[userId]) getSession(userId);
  sessions[userId] = { ...sessions[userId], ...data };
}

function resetSession(userId) {
  sessions[userId] = {
    name: null,
    flowActive: false,
    area: null,
    service: null,
    date: null,
    hour: null,
    dayName: null,
    context: {}
  };
}

module.exports = { getSession, updateSession, resetSession };
