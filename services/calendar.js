// services/calendar.js
const { google } = require("googleapis");

// Inicializa cliente
const googleAuth = new google.auth.GoogleAuth({
  credentials: {
    client_email: process.env.GOOGLE_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
  },
  scopes: ["https://www.googleapis.com/auth/calendar"],
});

const calendar = google.calendar({
  version: "v3",
  auth: googleAuth,
});

const CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID;

// ----------------------------------------------
// AYUDA: crea fecha fin sumando minutos
// ----------------------------------------------
function addMinutes(dateTime, minutes) {
  const d = new Date(dateTime);
  d.setMinutes(d.getMinutes() + minutes);
  return d.toISOString();
}

// ----------------------------------------------
// FORMATEAR FECHA + HORA A ISO
// ----------------------------------------------
function buildISO(dateStr, hourStr) {
  return `${dateStr}T${hourStr}:00-06:00`; // zona MX
}

// ----------------------------------------------
// OBTENER EVENTOS EXISTENTES EN ESA HORA
// ----------------------------------------------
async function getEventsAt(dateStr, hourStr) {
  const start = buildISO(dateStr, hourStr);
  const end = addMinutes(start, 60);

  const events = await calendar.events.list({
    calendarId: CALENDAR_ID,
    timeMin: start,
    timeMax: end,
    singleEvents: true,
    orderBy: "startTime",
  });

  return events.data.items || [];
}

// ----------------------------------------------
// REGLA: máximo 2 citas spa por hora
// ----------------------------------------------
async function checkSpaCapacity(dateStr, hourStr) {
  const events = await getEventsAt(dateStr, hourStr);

  // cuenta solo citas que no son de POLE
  const spaEvents = events.filter(e => {
    if (!e.summary) return false;
    return (
      e.summary.toLowerCase().includes("spa") ||
      e.summary.toLowerCase().includes("valoración") ||
      e.summary.toLowerCase().includes("facial") ||
      e.summary.toLowerCase().includes("corporal")
    );
  });

  return spaEvents.length < 2; // permitimos 0,1 → ok ; 2 → lleno
}

// ----------------------------------------------
// HORARIOS OFICIALES DE POLE TOWN ART
// ----------------------------------------------
const POLE_TIMETABLE = {
  monday: ["11:00", "18:00", "19:00"],
  tuesday: ["10:00", "11:00", "19:00", "20:15"],
  wednesday: ["11:00", "18:00", "19:00"],
  thursday: ["10:00", "18:00", "19:00", "20:30"],
  friday: ["11:00", "12:30", "18:00", "19:00"],
  saturday: ["10:00", "11:00", "13:00"],
  sunday: [] // cerrado
};

// ----------------------------------------------
// Validar si la hora elegida existe en POLE
// ----------------------------------------------
function validatePoleTime(dayName, hourStr) {
  const options = POLE_TIMETABLE[dayName] || [];
  return options.includes(hourStr);
}

// ----------------------------------------------
// CREAR EVENTO EN GOOGLE CALENDAR
// ----------------------------------------------
async function createEvent({ nombre, tipo, servicio, fecha, hora }) {
  const start = buildISO(fecha, hora);
  const end = addMinutes(start, 60);

  const summary =
    tipo === "SPA"
      ? `SPA – ${servicio}`
      : `Clase de ${servicio}`;

  const description =
    `Cliente: ${nombre}\n` +
    `Área: ${tipo}\n` +
    `Servicio: ${servicio}\n` +
    `Fecha: ${fecha} ${hora}\n` +
    `Origen: WhatsApp Bot`;

  const event = {
    summary,
    description,
    start: {
      dateTime: start,
      timeZone: "America/Mexico_City",
    },
    end: {
      dateTime: end,
      timeZone: "America/Mexico_City",
    }
  };

  const response = await calendar.events.insert({
    calendarId: CALENDAR_ID,
    resource: event,
  });

  return response.data;
}

// ----------------------------------------------
// API PRINCIPAL: validar y crear reserva
// ----------------------------------------------
async function bookReservation(session) {
  const { nombre, tipo, servicio, fecha, hora, poleDayName } = session;

  // SPA — Validar capacidad
  if (tipo === "SPA") {
    const available = await checkSpaCapacity(fecha, hora);

    if (!available) {
      return {
        ok: false,
        reason: "CAPACITY",
        message:
          "Lo siento, esa hora ya está llena 😥. Solo podemos atender a 2 personas por hora.\n\n¿Te propongo otro horario?"
      };
    }
  }

  // POLE — Validar horarios oficiales
  if (tipo === "POLE") {
    const okHour = validatePoleTime(poleDayName, hora);

    if (!okHour) {
      return {
        ok: false,
        reason: "INVALID_POLE_TIME",
        message:
          "Esa clase no existe en ese horario 🕒.\n\n¿Quieres que te diga los horarios disponibles para ese día?"
      };
    }
  }

  // Crear evento
  try {
    const event = await createEvent(session);

    return {
      ok: true,
      event,
      message:
        "Tu cita quedó registrada en nuestro calendario interno 🗓️💜"
    };
  } catch (err) {
    return {
      ok: false,
      reason: "CALENDAR_ERROR",
      message:
        "Tu cita quedó registrada conmigo, pero hubo un error al guardarla en el calendario. El equipo la revisará manualmente 💜"
    };
  }
}

module.exports = {
  getEventsAt,
  checkSpaCapacity,
  validatePoleTime,
  bookReservation,
  POLE_TIMETABLE
};
