const { stripAccents } = require("./normalize");

const months = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6,
  julio: 7, agosto: 8, septiembre: 9, setiembre: 9, octubre: 10, noviembre: 11, diciembre: 12
};

const dow = {
  lunes: 1, martes: 2, miercoles: 3, miércoles: 3, jueves: 4, viernes: 5, sabado: 6, sábado: 6, domingo: 0
};

function pad2(n) { return String(n).padStart(2, "0"); }

function toISODate(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function nextDow(fromDate, targetDow) {
  const d = new Date(fromDate);
  const diff = (7 + targetDow - d.getDay()) % 7;
  d.setDate(d.getDate() + (diff === 0 ? 7 : diff));
  return d;
}

function extractDate(textRaw) {
  const text = stripAccents(textRaw.toLowerCase());

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // hoy / mañana / pasado mañana
  if (text.includes("hoy")) return toISODate(today);

  if (text.includes("pasado manana") || text.includes("pasadomanana")) {
    const d = new Date(today);
    d.setDate(d.getDate() + 2);
    return toISODate(d);
  }

  if (text.includes("manana") || text.includes("mañana")) {
    const d = new Date(today);
    d.setDate(d.getDate() + 1);
    return toISODate(d);
  }

  // formato dd/mm o dd-mm (asume año actual; si ya pasó, año siguiente)
  let m = text.match(/(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?/);
  if (m) {
    let day = parseInt(m[1], 10);
    let month = parseInt(m[2], 10);
    let year = m[3] ? parseInt(m[3], 10) : now.getFullYear();
    if (year < 100) year += 2000;

    const d = new Date(year, month - 1, day);
    if (d < today) d.setFullYear(d.getFullYear() + 1);
    return toISODate(d);
  }

  // “15 de febrero”
  m = text.match(/(\d{1,2})\s*(de)?\s*(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)/);
  if (m) {
    const day = parseInt(m[1], 10);
    const month = months[m[3]];
    let year = now.getFullYear();
    const d = new Date(year, month - 1, day);
    if (d < today) d.setFullYear(d.getFullYear() + 1);
    return toISODate(d);
  }

  // día de la semana: “el lunes”, “este sábado”
  for (const k of Object.keys(dow)) {
    if (text.includes(k)) {
      const d = nextDow(today, dow[k]);
      return toISODate(d);
    }
  }

  return null;
}

function extractHour(textRaw) {
  const text = stripAccents(textRaw.toLowerCase());

  // 18:30 / 18.30
  let m = text.match(/(\d{1,2})[:\.](\d{2})/);
  let h = null;
  let min = 0;

  if (m) {
    h = parseInt(m[1], 10);
    min = parseInt(m[2], 10);
  } else {
    // “a las 6”, “6 pm”, “10 am”
    m = text.match(/(?:a\s*las\s*)?(\d{1,2})(?:\s*(am|pm))?/);
    if (!m) return null;
    h = parseInt(m[1], 10);
    min = 0;

    const ampm = m[2];
    if (ampm === "pm" && h < 12) h += 12;
    if (ampm === "am" && h === 12) h = 0;

    // “de la tarde/noche/mañana”
    if (text.includes("tarde") || text.includes("noche")) {
      if (h < 12) h += 12;
    }
    if (text.includes("manana") || text.includes("mañana")) {
      if (h === 12) h = 0;
    }
  }

  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return `${pad2(h)}:${pad2(min)}`;
}

function getDayName(isoDate) {
  const [Y, M, D] = isoDate.split("-").map(Number);
  const d = new Date(Y, M - 1, D);
  const day = d.getDay(); // 0 domingo
  return ["sunday","monday","tuesday","wednesday","thursday","friday","saturday"][day];
}

module.exports = { extractDate, extractHour, getDayName };
