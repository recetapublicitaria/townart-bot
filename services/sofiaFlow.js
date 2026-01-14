const { extractDate, extractHour, getDayName } = require("./utils/nlp");
const { updateSession, resetSession } = require("./session");
const { bookReservation } = require("./calendar");
const knowledge = require("./knowledge");

async function tryStartFlow(from, msg, session) {
  const text = msg.toLowerCase();

  // 1️⃣ PEDIR NOMBRE
  if (!session.name) {
    session.name = msg.trim();
    session.step = 1;
    updateSession(from, session);
    return `Gracias ${session.name} 💜\n¿Quieres reservar *SPA* o *CLASE DE POLE*?`;
  }

  // 2️⃣ TIPO DE SERVICIO
  if (!session.area) {
    if (text.includes("spa")) {
      session.area = "SPA";
      session.step = 2;
      updateSession(from, session);
      return (
        "Perfecto 💆‍♀️✨ ¿Qué tratamiento deseas?\n\n" +
        "Recomendación: normalmente empezamos con una *valoración* ($200) para que la especialista elija el mejor plan para ti."
      );
    }

    if (text.includes("pole")) {
      session.area = "POLE";
      session.step = 2;
      updateSession(from, session);
      return (
        "Genial 🩰 ¿Qué clase deseas tomar?\n" +
        knowledge.poleScheduleText
      );
    }

    return "Solo dime si quieres reservar *SPA* o *POLE* 💜";
  }

  // 3️⃣ SERVICIO
  if (!session.service) {
    session.service = msg.trim();
    session.step = 3;
    updateSession(from, session);

    if (session.area === "POLE")
      return "¿Qué día deseas asistir? (lunes, martes, sábado, etc.)";

    return "¿Para qué día deseas tu cita? (puedes decir: mañana, lunes, 20 de febrero…)";
  }

  // 4️⃣ FECHA
  if (!session.date) {
    const date = extractDate(text);
    if (!date) return "No entendí la fecha 😅 dime otra (mañana, lunes, 15 feb…)";
    session.date = date;
    session.dayName = getDayName(date);
    session.step = 4;
    updateSession(from, session);
    return "¿A qué hora te gustaría? (5 pm, 10 am, 7 de la tarde…)";
  }

  // 5️⃣ HORA
  if (!session.hour) {
    const hour = extractHour(text);
    if (!hour) return "No entendí la hora 😅 dime otra.";

    if (session.area === "POLE") {
      const allowed = knowledge.poleSchedule[session.dayName.toLowerCase()];
      if (!allowed || !allowed.includes(hour)) {
        return (
          "Ese horario no coincide con la clase 🕒\n\n" +
          knowledge.poleScheduleText
        );
      }
    }

    session.hour = hour;
    session.step = 5;
    updateSession(from, session);

    return (
      "✨ Te resumo tu cita:\n" +
      `👤 ${session.name}\n` +
      `📌 ${session.area}\n` +
      `✨ ${session.service}\n` +
      `📅 ${session.date}\n` +
      `⏰ ${session.hour}\n\n` +
      "¿Confirmamos? (sí / no)"
    );
  }

  // 6️⃣ CONFIRMACIÓN
  if (session.step === 5) {
    if (text.startsWith("si")) {
      const result = await bookReservation(session);
      resetSession(from);
      return "💜 *Cita confirmada*.\n" + result.message;
    }

    if (text.startsWith("no")) {
      session.date = null;
      session.hour = null;
      session.step = 3;
      updateSession(from, session);
      return "No pasa nada 💜 dime otra fecha.";
    }

    return "¿Deseas confirmar tu cita? (sí / no)";
  }

  return "Estoy aquí para ayudarte 💜";
}

module.exports = { tryStartFlow };
