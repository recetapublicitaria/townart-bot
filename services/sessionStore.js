// Memoria en RAM — se borra si el servidor reinicia
const sessions = {};

/*
  Estructura interna de la sesión:
  {
    name: "",
    flowActive: false,
    area: "",
    service: "",
    date: "",
    hour: "",
    dayName: "",
    lastMessage: "",
    suggestStartFlow: false,
    context: {}
  }
*/

// Obtener o crear sesión
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
      lastMessage: null,
      suggestStartFlow: false,
      context: {}
    };
  }
  return sessions[userId];
}

// Actualizar sesión
function updateSession(userId, data) {
  if (!sessions[userId]) getSession(userId);
  sessions[userId] = { ...sessions[userId], ...data };
}

// Reiniciar una sesión
function resetSession(userId) {
  sessions[userId] = {
    name: null,
    flowActive: false,
    area: null,
    service: null,
    date: null,
    hour: null,
    dayName: null,
    lastMessage: null,
    suggestStartFlow: false,
    context: {}
  };
}

module.exports = {
  get: getSession,
  set: updateSession,
  reset: resetSession,
};
