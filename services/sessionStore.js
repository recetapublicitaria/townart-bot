const { getSession, updateSession, resetSession } = require("./session");

module.exports = {
  get: getSession,
  set: updateSession,
  reset: resetSession,
};
