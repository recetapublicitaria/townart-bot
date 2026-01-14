// utils/nlp.js
// Detecta fechas naturales, horas naturales y días de la semana.

const MONTHS_ES = {
  enero: 0,
  febrero: 1,
  marzo: 2,
  abril: 3,
  mayo: 4,
  junio: 5,
  julio: 6,
  agosto: 7,
  septiembre: 8,
  octubre: 9,
  noviembre: 10,
  diciembre: 11
};

// -----------------------------
// CONVERTIR TEXTO → FECHA REAL
// -----------------------------
function extractDate(text) {
  const t = text.toLowerCase();

  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const afterTomorrow = new Date(today);
  afterTomorrow.setDate(today.getDate() + 2);

  // "mañana"
  if (t.includes("mañana")) {
    return formatDate(tomorrow);
  }

  // "pasado mañana"
  if (t.includes("pasado mañana")) {
    return formatDate(afterTomorrow);
  }

  // "hoy" (raro, pero válido)
  if (t.includes("hoy")) {
    return formatDate(today);
  }

  // Días de la semana
  const daysMap = {
    lunes: 1,
    martes: 2,
    miércoles: 3,
    miercoles: 3,
    jueves: 4,
    viernes: 5,
    sábado: 6,
    sabado: 6,
    domingo: 0
  };

  for (const key of Object.keys(daysMap)) {
    if (t.includes(key)) {
      return findNextWeekday(daysMap[key]);
    }
  }

  // Fechas tipo "15 de febrero"
  const matchFull = t.match(/(\d{1,2})\s*de\s*([a-z]+)/);
  if (matchFull) {
    const day = parseInt(matchFull[1]);
    const monthName = matchFull[2];
    const month = MONTHS_ES[monthName];

    if (month !== undefined) {
      const date = new Date();
      date.setMonth(month);
      date.setDate(day);

      // Si ya pasó este año, poner el siguiente
      if (date < today) {
        date.setFullYear(today.getFullYear() + 1);
      }

      return formatDate(date);
    }
  }

  // Formato "15 febrero"
  const matchSimple = t.match(/(\d{1,2})\s+([a-z]+)/);
  if (matchSimple) {
    const day = parseInt(matchSimple[1]);
    const month = MONTHS_ES[matchSimple[2]];
    if (month !== undefined) {
      const date = new Date();
      date.setMonth(month);
      date.setDate(day);
      if (date < today) date.setFullYear(today.getFullYear() + 1);
      return formatDate(date);
    }
  }

  return null; // No entendió la fecha
}

// Devuelve YYYY-MM-DD
function formatDate(d) {
  return d.toISOString().split("T")[0];
}

// Encuentra el siguiente lunes/martes/etc.
function findNextWeekday(targetDay) {
  const date = new Date();
  const todayDay = date.getDay(); // domingo = 0

  let diff = targetDay - todayDay;
  if (diff <= 0) diff += 7;

  date.setDate(date.getDate() + diff);

  return formatDate(date);
}

// -----------------------------
// EXTRAER HORA NATURAL
// -----------------------------
function extractHour(text) {
  const t = text.toLowerCase();

  // "a las 5"
  const match1 = t.match(/a las (\d{1,2})/);
  if (match1) {
    const h = normalizeHour(match1[1], t);
    return formatHour(h);
  }

  // "5 pm", "7 am"
  const match2 = t.match(/(\d{1,2})\s*(am|pm)/);
  if (match2) {
    let h = parseInt(match2[1]);
    const ap = match2[2];

    if (ap === "pm" && h < 12) h += 12;
    if (ap === "am" && h === 12) h = 0;

    return formatHour(h);
  }

  // "a las 6 de la tarde"
  if (t.includes("tarde") || t.includes("pm")) {
    const n = t.match(/(\d{1,2})/);
    if (n) {
      let h = parseInt(n[1]);
      if (h < 12) h += 12;
      return formatHour(h);
    }
  }

  // "10 de la mañana"
  if (t.includes("mañana") || t.includes("am")) {
    const n = t.match(/(\d{1,2})/);
    if (n) {
      let h = parseInt(n[1]);
      if (h === 12) h = 0;
      return formatHour(h);
    }
  }

  return null; // no entendió
}

function normalizeHour(hour, text) {
  let h = parseInt(hour);

  if (text.includes("pm") || text.includes("tarde") || text.includes("noche")) {
    if (h < 12) h += 12;
  }

  if (text.includes("am") || text.includes("mañana")) {
    if (h === 12) h = 0;
  }

  return h;
}

function formatHour(h) {
  const hour = String(h).padStart(2, "0");
  return hour + ":00";
}

// Día de la semana en inglés para POLE schedule
function getDayOfWeek(dateStr) {
  const d = new Date(dateStr);
  return [
    "sunday",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday"
  ][d.getDay()];
}

module.exports = {
  extractDate,
  extractHour,
  getDayOfWeek
};
