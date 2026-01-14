const { normalize } = require("./normalize");

// ====================================
// DETECTAR INTENCIÓN DEL USUARIO
// ====================================
function detectIntent(text, session = {}) {
  const t = normalize(text);

  // Intento de reservar
  if (
    t.includes("agendar") ||
    t.includes("reserv") ||
    t.includes("cita") ||
    t.includes("quiero una clase") ||
    t.includes("quiero asistir") ||
    t.includes("agenda")
  ) {
    return "start_reservation";
  }

  // Pregunta de información
  if (
    t.includes("precio") ||
    t.includes("cuanto cuesta") ||
    t.includes("que incluye") ||
    t.includes("horario") ||
    t.includes("donde estan") ||
    t.includes("ubicacion")
  ) {
    return "info";
  }

  // Recomendación
  if (
    t.includes("que recomiendas") ||
    t.includes("que clase") ||
    t.includes("que tratamiento") ||
    t.includes("me aconsejas") ||
    t.includes("me sirve")
  ) {
    return "recommend";
  }

  // Temas específicos
  if (t.includes("acne") || t.includes("manchas") || t.includes("facial")) {
    return "skin_issue";
  }

  if (t.includes("pole") || t.includes("clase")) {
    return "pole_info";
  }

  return "general";
}

// ====================================
// FECHAS NATURALES → YYYY-MM-DD
// ====================================
function extractDate(text) {
  const t = normalize(text);
  const today = new Date();

  // "hoy"
  if (t.includes("hoy")) return format(today);

  // "mañana"
  if (t.includes("mañana")) {
    const d = addDays(today, 1);
    return format(d);
  }

  // "pasado mañana"
  if (t.includes("pasado manana")) {
    const d = addDays(today, 2);
    return format(d);
  }

  // Días de semana
  const days = {
    lunes: 1,
    martes: 2,
    miercoles: 3,
    jueves: 4,
    viernes: 5,
    sabado: 6,
    domingo: 0,
  };

  for (const day of Object.keys(days)) {
    if (t.includes(day)) {
      return nextWeekday(days[day]);
    }
  }

  // Fechas "15 de febrero"
  const exp = /(\d{1,2})\s*(de)?\s*(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)/;
  const match = t.match(exp);

  if (match) {
    const day = parseInt(match[1]);
    const monthName = match[3];
    const month = monthToNumber(monthName);

    const d = new Date();
    d.setMonth(month);
    d.setDate(day);

    // si es fecha pasada → próximo año
    if (d < today) d.setFullYear(today.getFullYear() + 1);
    return format(d);
  }

  return null;
}

function monthToNumber(m) {
  const months = {
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
    diciembre: 11,
  };
  return months[m];
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function format(date) {
  return date.toISOString().split("T")[0];
}

function nextWeekday(targetDay) {
  const now = new Date();
  const day = now.getDay();
  let diff = targetDay - day;
  if (diff <= 0) diff += 7;

  const d = addDays(now, diff);
  return format(d);
}

// ====================================
// HORA NATURAL → HH:MM
// ====================================
function extractHour(text) {
  const t = normalize(text);

  // "a las 5"
  const m1 = t.match(/a las (\d{1,2})/);
  if (m1) return normalizeHour(parseInt(m1[1]), t);

  // "5 pm"
  const m2 = t.match(/(\d{1,2})\s*(pm|am)/);
  if (m2) return cleanHour(parseInt(m2[1]), m2[2]);

  // "a las 6 de la tarde"
  if (t.includes("tarde") || t.includes("noche")) {
    const n = t.match(/(\d{1,2})/);
    if (n) return normalizeHour(parseInt(n[1]) + 12, t);
  }

  // "10 de la mañana"
  if (t.includes("mañana")) {
    const n = t.match(/(\d{1,2})/);
    if (n) return normalizeHour(parseInt(n[1]), "am");
  }

  return null;
}

function cleanHour(h, ap) {
  if (ap === "pm" && h < 12) h += 12;
  if (ap === "am" && h === 12) h = 0;
  return formatHour(h);
}

function normalizeHour(h) {
  if (h < 0 || h > 23) return null;
  return formatHour(h);
}

function formatHour(h) {
  return `${String(h).padStart(2, "0")}:00`;
}

// ====================================
// DÍA DE SEMANA → monday, tuesday...
// ====================================
function getDayName(dateStr) {
  const d = new Date(dateStr);
  return [
    "sunday",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
  ][d.getDay()];
}

module.exports = {
  detectIntent,
  extractDate,
  extractHour,
  getDayName,
};
