// Memoria en RAM — más adelante podemos migrarlo a Redis
const sessions = {};

/**
 * Estructura de sesión coherente con SofiaFlow:
 * {
 *   name: "",
 *   step: 0,                // ← NECESARIO PARA EL FLUJO
 *   flowActive: false,
 *   area: "",               // SPA / POLE
 *   service: "",
 *   date: "",
 *   hour: "",
 *   dayName: "",
 *   suggestStartFlow: false,
 *   lastMessage: "",
 *   context: {}
 * }
 */

function baseSession() {
  return {
    name: null,
    step: 0,
    flowActive: false,
    area: null,
    service: null,
    date: null,
    hour: null,
    dayName: null,
    suggestStartFlow: false,
    lastMessage: null,
    context: {},
  };
}

// Obtener o crear sesión
function getSession(userId) {
  if (!sessions[userId]) sessions[userId] = baseSession();
  return sessions[userId];
}

// Actualizar sesión
function updateSession(userId, newData) {
  if (!sessions[userId]) sessions[userId] = baseSession();

  sessions[userId] = {
    ...sessions[userId],
    ...newData,
  };
}

// Reiniciar sesión COMPLETA
function resetSession(userId) {
  sessions[userId] = baseSession();
}

module.exports = {
  getSession,
  updateSession,
  resetSession,
};
