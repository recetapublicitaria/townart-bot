// services/session.js

// Memoria en RAM (si reinicias el server se limpia)
const sessions = {};

// Palabra clave para reiniciar sesión
const RESET_WORDS = ["reset", "reiniciar", "borrar", "empezar de nuevo", "limpiar"];

// --------------------------------------
// Ver si el usuario pidió reiniciar
// --------------------------------------
function checkReset(message) {
  const t = message.toLowerCase();
  return RESET_WORDS.some(word => t.includes(word));
}

// --------------------------------------
// Obtener sesión del usuario
// --------------------------------------
function getSession(user) {
  if (!sessions[user]) {
    sessions[user] = {
      nombre: null,
      tipo: null,      // SPA o POLE
      servicio: null,
      fecha: null,
      hora: null,
      poleDayName: null,
      step: 0
    };
  }
  return sessions[user];
}

// --------------------------------------
// Guardar cambios en la sesión
// --------------------------------------
function updateSession(user, data) {
  sessions[user] = { ...sessions[user], ...data };
}

// --------------------------------------
// Resetear diálogo
// --------------------------------------
function resetSession(user) {
  sessions[user] = {
    nombre: null,
    tipo: null,
    servicio: null,
    fecha: null,
    hora: null,
    poleDayName: null,
    step: 0
  };
  return sessions[user];
}

module.exports = {
  getSession,
  updateSession,
  resetSession,
  checkReset
};
