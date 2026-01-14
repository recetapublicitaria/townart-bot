const { google } = require("googleapis");

// ===========================
// 1) CONFIGURACIÓN GOOGLE API
// ===========================
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

// ===========================
// FORMATEADORES
// ===========================
function buildISO(date, hour) {
  return `${date}T${hour}:00-06:00`; // Horario CDMX
}

function addMinutes(dateTimeStr, minutes) {
  const d = new Date(dateTimeStr);
  d.setMinutes(d.getMinutes() + minutes);
  return d.toISOString();
}

// ===========================
// 2) OBTENER EVENTOS EXISTENTES
// ===========================
async function getEvents(date, hour) {
  const start = buildISO(date, hour);
  const end = addMinutes(start, 60);

  const res = await calendar.events.list({
    calendarId: CALENDAR_ID,
    timeMin: start,
    timeMax: end,
    singleEvents: true,
    orderBy: "startTime",
  });

  return res.data.items || [];
}

// ===========================
// 3) CAPACIDAD DEL SPA
// Máximo 2 citas por hora
// ===========================
async function checkSpaCapacity(date, hour) {
  const events = await getEvents(date, hour);

  const spaEvents = events.filter((e) => {
    if (!e.summary) return false;
    const s = e.summary.toLowerCase();
    return (
      s.includes("spa") ||
      s.includes("facial") ||
      s.includes("corporal") ||
      s.includes("valoración")
    );
  });

  return spaEvents.length < 2; // permite 0 y 1; bloquea 2
}

// ===========================
// 4) CREAR EVENTO EN CALENDAR
// ===========================
async function createEvent(session) {
  const { name, area, service, date, hour } = session;

  const start = buildISO(date, hour);
  const end = addMinutes(start, 60);

  const summary =
    area === "SPA"
      ? `SPA – ${service}`
      : `Clase de ${service}`;

  const description =
    `Cliente: ${name}\n` +
    `Área: ${area}\n` +
    `Servicio: ${service}\n` +
    `Fecha: ${date} ${hour}\n` +
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
    },
  };

  const res = await calendar.events.insert({
    calendarId: CALENDAR_ID,
    resource: event,
  });

  return res.data;
}

// ===========================
// 5) API PRINCIPAL PARA RESERVAR
// ===========================
async function bookReservation(session) {
  const { area, date, hour } = session;

  // SPA → Validar capacidad
  if (area === "SPA") {
    const ok = await checkSpaCapacity(date, hour);

    if (!ok) {
      return {
        ok: false,
        message:
          "Lo siento 💜 esa hora ya está llena (tenemos cupo para 2 personas por hora en SPA).\n¿Quieres que te sugiera otro horario disponible?",
      };
    }
  }

  // POLE → La disponibilidad ya se validó antes en sofiaFlow.js

  try {
    const event = await createEvent(session);

    return {
      ok: true,
      event,
      message:
        "✨ Tu cita quedó registrada en nuestro calendario interno.\nEn breve recibirás confirmación del equipo 💜",
    };
  } catch (err) {
    console.error("❌ Error creando evento:", err);

    return {
      ok: false,
      message:
        "Tu cita quedó registrada conmigo 💜, pero hubo un problema al guardarla en el calendario. El equipo la revisará manualmente.",
    };
  }
}

module.exports = {
  getEvents,
  checkSpaCapacity,
  createEvent,
  bookReservation,
};
