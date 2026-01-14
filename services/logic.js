// services/logic.js
// Maneja la intención del usuario, y el flujo completo de reservas.

const nlp = require("./utils/nlp");
const { updateSession, getSession } = require("./session");
const { createCalendarEvent, checkAvailability } = require("./calendar");

// Horarios fijos de POLE
const poleSchedule = {
  monday: ["11:00", "18:00", "19:00"],
  tuesday: ["10:00", "11:00", "19:00", "20:15"],
  wednesday: ["11:00", "18:00", "19:00"],
  thursday: ["10:00", "18:00", "19:00", "20:30"],
  friday: ["11:00", "12:30", "18:00", "19:00"],
  saturday: ["10:00", "11:00", "13:00"]
};

// Detecta intención general
function detectIntent(text) {
  const t = text.toLowerCase();

  if (
    t.includes("agendar") ||
    t.includes("reserv") ||
    t.includes("cita") ||
    t.includes("quiero apartar") ||
    t.includes("quiero una clase")
  ) {
    return "booking";
  }

  if (
    t.includes("qué cuesta") ||
    t.includes("precio") ||
    t.includes("qué incluye") ||
    t.includes("horario")
  ) {
    return "info";
  }

  if (
    t.includes("qué me recomiendas") ||
    t.includes("qué tratamiento") ||
    t.includes("qué facial") ||
    t.includes("qué clase")
  ) {
    return "recommend";
  }

  return "fallback";
}

// -------------------------
// FLUJO PRINCIPAL DE RESERVA
// -------------------------

async function processBookingFlow(from, userMessage) {
  const session = getSession(from);
  const text = userMessage.toLowerCase();

  // PASO 1 — Pedir nombre
  if (!session.nombre) {
    session.nombre = userMessage.trim();
    updateSession(from, session);
    return {
      reply:
        `Gracias ${session.nombre} 💜\n\n¿La reserva es para *SPA* o para una *CLASE DE POLE*?`
    };
  }

  // PASO 2 — Elegir SPA o POLE
  if (!session.tipo) {
    if (text.includes("spa")) {
      session.tipo = "SPA";
      updateSession(from, session);

      return {
        reply:
          "Perfecto 💆‍♀️\n\n¿Qué servicio te interesa? Ejemplo: limpieza facial profunda, hidratante, despigmentante, masaje, drenaje linfático, etc.\n\n*Recomendación:* Para cualquier tratamiento facial o corporal, lo ideal es una valoración con especialista ($200)."
      };
    }

    if (text.includes("pole")) {
      session.tipo = "POLE";
      updateSession(from, session);

      return {
        reply:
          "¡Genial! 🩰\n\n¿Qué clase te interesa?\nPole Fitness, Flying Pole, Flexi, Floorwork o Acrobacia.\n\nCuando me digas la clase te comparto los días y horarios disponibles."
      };
    }

    return { reply: "¿Es para *SPA* o para *CLASE DE POLE*?" };
  }

  // PASO 3 — Elegir servicio
  if (!session.servicio) {
    session.servicio = userMessage.trim();
    updateSession(from, session);

    // Si es POLE → mostrar horarios
    if (session.tipo === "POLE") {
      return {
        reply: formatPoleSchedule()
      };
    }

    // Si es SPA → continuar con fecha
    return {
      reply: "Perfecto ✨\n¿Qué día te gustaría? Puedes decir algo natural como:\n• mañana\n• el lunes\n• este sábado\n• el 15 de febrero"
    };
  }

  // PASO 4 — Fecha natural → convertir a YYYY-MM-DD
  if (!session.fecha) {
    const parsed = nlp.extractDate(userMessage);

    if (!parsed) {
      return {
        reply:
          "No entendí bien la fecha 😅\nIntenta algo como:\n• mañana\n• el viernes\n• el 12 de enero"
      };
    }

    session.fecha = parsed;
    updateSession(from, session);

    return {
      reply:
        "¿Y a qué hora te gustaría? Puedes decir:\n• a las 5\n• 6 de la tarde\n• 10 am"
    };
  }

  // PASO 5 — Hora natural → convertir a HH:MM 24h
  if (!session.hora) {
    const hour = nlp.extractHour(userMessage);

    if (!hour) {
      return {
        reply: "No entendí bien la hora 😅\nDime algo como:\n• a las 5\n• 6 pm\n• 10 de la mañana"
      };
    }

    session.hora = hour;
    updateSession(from, session);

    // Validación POLE: debe coincidir con horario real
    if (session.tipo === "POLE") {
      const day = nlp.getDayOfWeek(session.fecha);
      const allowed = poleSchedule[day];

      if (!allowed || !allowed.includes(session.hora)) {
        return {
          reply:
            "Esa hora no coincide con los horarios oficiales de la clase 🩰.\n\n" +
            formatPoleSchedule()
        };
      }
    }

    // Revisar disponibilidad en Google Calendar
    const available = await checkAvailability(session.fecha, session.hora);

    if (!available) {
      return {
        reply:
          "Ese horario ya está lleno 😢\nElige otra hora disponible por favor."
      };
    }

    // Pedir confirmación final
    return {
      reply:
        `Perfecto 💜\nTe resumo:\n\n` +
        `👤 Nombre: ${session.nombre}\n` +
        `📌 Área: ${session.tipo}\n` +
        `✨ Servicio/Clase: ${session.servicio}\n` +
        `📅 Fecha: ${session.fecha}\n` +
        `⏰ Hora: ${session.hora}\n\n` +
        `¿Agendamos? (Sí / No)`
    };
  }

  // PASO 6 — Confirmación final
  if (text.startsWith("si")) {
    try {
      await createCalendarEvent(session);

      // Reiniciar flujo
      updateSession(from, {});

      return {
        reply:
          "🗓️✨ ¡Listo! Tu cita quedó registrada.\nCualquier detalle, aquí estoy 💜"
      };
    } catch (e) {
      return {
        reply:
          "Hubo un problema al guardar la cita, pero yo la tengo registrada. El equipo la revisará manualmente 🙏"
      };
    }
  }

  if (text.startsWith("no")) {
    // Permitir que cambie fecha u hora sin reiniciar todo
    session.fecha = null;
    session.hora = null;
    updateSession(from, session);

    return {
      reply:
        "Sin problema 💜\nDime qué nueva *fecha* te gustaría y lo ajustamos."
    };
  }

  return { reply: "¿Quieres confirmar tu cita? (Sí / No)" };
}

// -------------------------
// FORMATO BONITO DE HORARIOS DE POLE
// -------------------------
function formatPoleSchedule() {
  return (
    "Los horarios oficiales de Pole Fitness en Town Art son:\n\n" +
    "🗓️ *Lunes*: 11:00, 18:00, 19:00\n" +
    "🗓️ *Martes*: 10:00, 11:00, 19:00, 20:15\n" +
    "🗓️ *Miércoles*: 11:00, 18:00, 19:00\n" +
    "🗓️ *Jueves*: 10:00, 18:00, 19:00, 20:30\n" +
    "🗓️ *Viernes*: 11:00, 12:30, 18:00, 19:00\n" +
    "🗓️ *Sábado*: 10:00, 11:00, 13:00\n\n" +
    "¿Qué día quieres asistir?"
  );
}

module.exports = {
  detectIntent,
  processBookingFlow
};
