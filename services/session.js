const { getSession } = require("./sessionStore");

function initSession(from) {
  const session = getSession(from);

  if (!session.memory) session.memory = {};

  return session;
}

module.exports = { initSession };
