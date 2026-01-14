// SessionStore — interfaz estándar del motor Sofia

const {
  getSession,
  updateSession,
  resetSession,
} = require("./session");

module.exports = {
  get: (id) => getSession(id),
  set: (id, data) => updateSession(id, data),
  reset: (id) => resetSession(id),
};
