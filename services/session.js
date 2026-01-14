// Memoria en RAM — se reinicia si el servidor se reinicia
// Más adelante podemos migrarlo a base de datos si lo deseas
const sessions = {};

/**
 * Estructura de sesión:
 * {
 *   name: "",
 *   flowActive: false,
 *   area: "",             // SPA / POLE
 *   service: "",
 *   date: "",
 *   hour: "",
 *   dayName: "",
 *   lastMessage: "",
 *   suggestStartFlow: false,
 *   context: {}           // memoria contextual adicional
 * }
 */

// Crear o recuperar sesión
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
      context: {},
    };
  }
  return sessions[userId];
}

// Actualizar sesión
function updateSession(userId, data) {
  if (!sessions[userId]) getSession(userId);
  sessions[userId] = { ...sessions[userId], ...data };
}

// Reset total (para pruebas o reiniciar diálogo)
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
    context: {},
  };
}

module.exports = {
  getSession,
  updateSession,
  resetSession,
};
