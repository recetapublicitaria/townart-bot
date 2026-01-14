const { extractDate, extractHour, getDayName } = require("./utils/nlp");
const store = require("./sessionStore");
const { bookReservation } = require("./calendar");
const knowledge = require("./knowledge");
const { stripAccents } = require("./utils/normalize");

function normalize(s) {
  return stripAccents(String(s || "").toLowerCase()).trim();
}

function isYes(t) {
  t = normalize(t);
  return t === "si" || t.startsWith("si ") || t.startsWith("sí") || t.startsWith("sip") || t === "claro" || t.includes("confirmo");
}
function isNo(t) {
  t = normalize(t);
  return t === "no" || t.startsWith("no ") || t.includes("cambiar") || t.includes("ajustar");
}

function friendlyIntro(session) {
  const name = session.name ? ` ${session.name}` : "";
  return `Perfecto${name} 💜`;
}

// Detecta área por conversación previa (si venían hablando de acné/facial/corporal => SPA)
function inferAreaFromText(textNorm) {
  const spaHints = ["acne","acné","facial","limpieza","manchas","despigment","masaje","drenaje","reductivo","estrias","celulitis","depil", "piel"];
  const poleHints = ["pole","flying","flexi","floorwork","acroba","clase"];
  if (spaHints.some(k => textNorm.includes(k))) return "SPA";
  if (poleHints.some(k => textNorm.includes(k))) return "POLE";
  return null;
}

async function tryStartFlow(from, msg, session) {
  const t = normalize(msg);

  // Paso 0: asegurar nombre (si no existe)
  if (!session.name) {
    // si el usuario escribió “quiero agendar” no es nombre:
    const looksLikeRequest = ["agendar","cita","reservar","reserva","quiero"].some(k => t.includes(k));
    if (looksLikeRequest) {
      store.set(from, { active: true, step: 0 });
      return "Claro 💜 ¿a nombre de quién agendamos?";
    }

    store.set(from, { name: msg.trim(), active: true, step: 1 });
    return `Gracias ${msg.trim()} 💜\n\n¿Reservamos para *Spa* o para *clase de pole*?`;
  }

  // Si se activó pero step=0, pedir nombre (ya lo tiene) y avanzar
  if (session.active && session.step === 0) {
    store.set(from, { step: 1 });
    return `Súper, ${session.name} 💜\n\n¿Reservamos para *Spa* o para *clase de pole*?`;
  }

  // Paso 1: definir área (SPA/POLE) — pero si ya veníamos hablando de SPA, no lo vuelvas robot
  if (!session.area) {
    const inferred = inferAreaFromText(t) || session.lastAreaHint;

    if (t.includes("spa") || inferred === "SPA") {
      store.set(from, { area: "SPA", step: 2 });
      return (
        `${friendlyIntro(session)}\n` +
        `¿Qué te gustaría agendar?\n` +
        `Si es un tratamiento (acné, manchas, etc.), lo ideal es empezar con *valoración* ($${knowledge.spa.valuation.price}, 30 min).`
      );
    }

    if (t.includes("pole") || inferred === "POLE") {
      store.set(from, { area: "POLE", step: 2 });
      return (
        `${friendlyIntro(session)}\n` +
        `¿Qué clase te interesa?\n• Pole Fitness\n• Flying Pole\n• Flexi\n• Floorwork\n• Acrobacia\n\n` +
        `Te comparto horarios oficiales en cuanto me digas cuál 😊`
      );
    }

    return "Para agendar 💜 ¿es *Spa* o *clase de pole*?";
  }

  // Paso 2: servicio
  if (!session.service) {
    const service = msg.trim();
    store.set(from, { service, step: 3 });

    if (session.area === "POLE") {
      return (
        `Perfecto 🩰\n\n${knowledge.poleScheduleText}\n\n` +
        `Dime qué día te gustaría (por ejemplo: “lunes” o “este sábado”).`
      );
    }

    return (
      `Perfecto ✨\n` +
      `¿Qué día te gustaría? Puedes decir: “mañana”, “el lunes”, “este sábado”, “15 de febrero”…`
    );
  }

  // Paso 3: fecha (natural)
  if (!session.date) {
    const date = extractDate(t);
    if (!date) {
      return "No entendí la fecha 😅 ¿Me la dices así?: “mañana”, “el lunes” o “15 de febrero”.";
    }

    const dayName = getDayName(date);
    store.set(from, { date, dayName, step: 4 });

    // POLE: después de fecha, pedimos hora pero VALIDAREMOS vs horarios
    return `Perfecto 💜 ¿a qué hora? (por ejemplo “6 pm”, “11:00”, “a las 10”)`;
  }

  // Paso 4: hora (natural)
  if (!session.hour) {
    const hour = extractHour(t);
    if (!hour) {
      return "No entendí la hora 😅 Dime por ejemplo: “6 pm”, “10 am”, “18:00”.";
    }

    // Validación POLE: horarios reales
    if (session.area === "POLE") {
      const allowed = knowledge.poleSchedule[session.dayName] || [];
      if (!allowed.includes(hour)) {
        return (
          `Esa hora no coincide con los horarios oficiales 🕒\n\n` +
          `${knowledge.poleScheduleText}\n\n` +
          `Elige uno de esos horarios y lo agendamos 💜`
        );
      }
    }

    store.set(from, { hour, step: 5 });

    // Resumen final (aquí sí usamos formato estricto)
    return (
      `✨ Te resumo para confirmar:\n\n` +
      `👤 Nombre: ${session.name}\n` +
      `📌 Área: ${session.area}\n` +
      `✨ Servicio: ${session.service}\n` +
      `📅 Fecha: ${session.date}\n` +
      `⏰ Hora: ${session.hour}\n\n` +
      `¿Confirmamos? (sí / no)`
    );
  }

  // Paso 5: confirmar
  if (session.step === 5) {
    if (isYes(t)) {
      const result = await bookReservation(session);

      if (!result.ok) {
        // No reseteamos; dejamos que elija otra hora/día
        store.set(from, { hour: null, step: 4 });
        return result.message;
      }

      store.reset(from); // reinicio completo, pero conservar nombre sería útil:
      // Si quieres conservar nombre entre resets, dímelo y lo dejo persistente.

      return `💜 Listo, quedó confirmada.\n\n${result.message}`;
    }

    if (isNo(t)) {
      store.set(from, { date: null, hour: null, step: 3 });
      return "Va 💜 dime qué otro día te gustaría.";
    }

    return "¿Confirmamos? (sí / no)";
  }

  return "Te leo 💜";
}

module.exports = { tryStartFlow };
