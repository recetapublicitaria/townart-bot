const sessions = {};

// Sesión por usuario (WhatsApp number)
function getSession(userId) {
  if (!sessions[userId]) {
    sessions[userId] = {
      greeted: false,
      name: null,

      // flujo reserva
      active: false,
      step: 0,         // 0..5
      area: null,      // SPA | POLE
      service: null,
      date: null,      // YYYY-MM-DD
      hour: null,      // HH:MM
      dayName: null,   // monday..sunday

      // contexto ligero
      lastTopic: null,
      lastAreaHint: null // "SPA" o "POLE" si veníamos hablando de eso
    };
  }
  return sessions[userId];
}

function updateSession(userId, patch) {
  const s = getSession(userId);
  sessions[userId] = { ...s, ...patch };
  return sessions[userId];
}

function resetSession(userId) {
  delete sessions[userId];
}

module.exports = { getSession, updateSession, resetSession };
