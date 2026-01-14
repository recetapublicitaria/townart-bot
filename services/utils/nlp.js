const days = {
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

// ----------------------
// EXTRAER FECHA NATURAL
// ----------------------
function extractDate(text) {
  const now = new Date();
  const lower = text.toLowerCase();

  if (lower.includes("mañana")) {
    const d = new Date();
    d.setDate(now.getDate() + 1);
    return d.toISOString().split("T")[0];
  }

  for (const dname in days) {
    if (lower.includes(dname)) {
      const today = now.getDay();
      let target = days[dname];

      let diff = target - today;
      if (diff <= 0) diff += 7;

      const d = new Date();
      d.setDate(now.getDate() + diff);
      return d.toISOString().split("T")[0];
    }
  }

  const match = lower.match(/(\d{1,2})\/(\d{1,2})/);
  if (match) {
    const d = new Date();
    d.setMonth(Number(match[2]) - 1);
    d.setDate(Number(match[1]));
    return d.toISOString().split("T")[0];
  }

  return null;
}

// ----------------------
// EXTRAER HORA NATURAL
// ----------------------
function extractHour(text) {
  const lower = text.toLowerCase();

  const match = lower.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/);
  if (!match) return null;

  let hour = parseInt(match[1]);
  const minutes = match[2] ? parseInt(match[2]) : 0;
  const ampm = match[3];

  if (ampm === "pm" && hour < 12) hour += 12;
  if (ampm === "am" && hour === 12) hour = 0;

  return `${String(hour).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

// ----------------------
function getDayName(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("es-MX", { weekday: "long" });
}

module.exports = { extractDate, extractHour, getDayName };
