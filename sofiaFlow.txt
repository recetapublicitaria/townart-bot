const { extractDate, extractHour, detectIntent, getDayName } = require("./utils/nlp");
const { updateSession, resetSession } = require("./session");
const { bookReservation } = require("./calendar");
const knowledge = require("./knowledge");

// ---------------------------------------------
// FUNCIÓN PRINCIPAL DEL FLUJO DE RESERVA
// ---------------------------------------------
async function tryStartFlow(from, msg, session, intent) {
  const text = msg.toLowerCase();

  // -----------------------------
  // PASO 1: PEDIR NOMBRE
  // -----------------------------
  if (!session.name) {
    session.name = msg.trim();
    session.step = 1;
    updateSession(from, session);
    return `Gracias ${session.name} 💜\n\n¿Quieres reservar *SPA* o *CLASE DE POLE*?`;
  }

  // -----------------------------
  // PASO 2: TIPO DE RESERVA (SPA / POLE)
  // -----------------------------
  if (!session.area) {
    if (text.includes("spa")) {
      session.area = "SPA";
      session.step = 2;
      updateSession(from, session);
      return (
        "Perfecto 💆‍♀️✨\n" +
        "¿Qué tratamiento deseas?\n\n" +
        "Por cierto, normalmente recomendamos iniciar con una *valoración* ($200), porque así la especialista analiza tu piel y elige el mejor plan para ti."
      );
    }

    if (text.includes("pole")) {
      session.area = "POLE";
      session.step = 2;
      updateSession(from, session);

      return (
        "¡Genial! 🩰\n" +
        "¿Qué clase deseas tomar?\n" +
        "Opciones:\n• Pole Fitness\n• Flying Pole\n• Flexi\n• Floorwork\n• Acrobacia\n\n" +
        "Cuando elijas, te digo los horarios oficiales."
      );
    }

    return "Solo para confirmar 💜 ¿reservas *SPA* o *CLASE DE POLE*?";
  }

  // -----------------------------
  // PASO 3: SERVICIO
  // -----------------------------
  if (!session.service) {
    session.service = msg.trim();
    session.step = 3;
    updateSession(from, session);

    if (session.area === "POLE") {
      return (
        "Perfecto 🩰 Estas son las clases disponibles:\n\n" +
        knowledge.poleScheduleText +
        "\n¿Qué día te gustaría asistir?"
      );
    }

    return (
      "Perfecto ✨\n" +
      "¿Para qué día te gustaría tu cita?\nPuedes decir:\n" +
      "• mañana\n• el lunes\n• este sábado\n• el 15 de febrero"
    );
  }

  // -----------------------------
  // PASO 4: FECHA
  // -----------------------------
  if (!session.date) {
    const parsedDate = extractDate(text);

    if (!parsedDate) {
      return (
        "No logré entender la fecha 😅\nIntenta algo como:\n" +
        "• mañana\n• pasado mañana\n• el viernes\n• el 20 de marzo"
      );
    }

    session.date = parsedDate;
    session.dayName = getDayName(parsedDate);
    session.step = 4;
    updateSession(from, session);

    return "¿A qué hora te gustaría? Puedes decir:\n• a las 5\n• 6 pm\n• 10 de la mañana\n• 7 de la tarde";
  }

  // -----------------------------
  // PASO 5: HORA
  // -----------------------------
  if (!session.hour) {
    const parsedHour = extractHour(text);

    if (!parsedHour) {
      return (
        "No entendí la hora 😅\nDime algo como:\n" +
        "• 5 pm\n• a las 6\n• 10 am\n• 7 de la tarde"
      );
    }

    // Validación POLE
    if (session.area === "POLE") {
      const allowed = knowledge.poleSchedule[session.dayName];

      if (!allowed || !allowed.includes(parsedHour)) {
        return (
          "Esa hora no coincide con los horarios oficiales de la clase 🕒\n\n" +
          knowledge.poleScheduleText +
          "\nElige cualquiera de esos horarios ✨"
        );
      }
    }

    session.hour = parsedHour;
    session.step = 5;
    updateSession(from, session);

    return (
      "✨ Te resumo tu cita:\n\n" +
      `👤 Nombre: ${session.name}\n` +
      `📌 Área: ${session.area}\n` +
      `✨ Servicio: ${session.service}\n` +
      `📅 Fecha: ${session.date}\n` +
      `⏰ Hora: ${session.hour}\n\n` +
      "¿Confirmamos? (sí / no)"
    );
  }

  // -----------------------------
  // PASO 6: CONFIRMAR
  // -----------------------------
  if (session.step === 5) {
    if (text.startsWith("si")) {
      const result = await bookReservation(session);

      resetSession(from);

      return (
        "💜 *Cita confirmada*\n" +
        result.message +
        "\n\nCualquier cosita, estoy por aquí ✨"
      );
    }

    if (text.startsWith("no")) {
      session.date = null;
      session.hour = null;
      session.step = 4;
      updateSession(from, session);
      return "No pasa nada 💜 dime otra fecha para tu cita.";
    }

    return "¿Deseas confirmar tu cita? (sí / no)";
  }

  return "Solo dime que sí o no ✨";
}

module.exports = { tryStartFlow };
