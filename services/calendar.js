const { google } = require("googleapis");
const knowledge = require("./knowledge");

const googleAuth = new google.auth.GoogleAuth({
  credentials: {
    client_email: process.env.GOOGLE_CLIENT_EMAIL,
    private_key: (process.env.GOOGLE_PRIVATE_KEY || "").replace(/\\n/g, "\n")
  },
  scopes: ["https://www.googleapis.com/auth/calendar"]
});

const calendar = google.calendar({ version: "v3", auth: googleAuth });
const CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID;

function buildDateTimes(dateISO, hourHHMM, durMinutes = 60) {
  const start = new Date(`${dateISO}T${hourHHMM}:00`);
  const end = new Date(start.getTime() + durMinutes * 60000);

  return {
    startISO: start.toISOString(),
    endISO: end.toISOString()
  };
}

async function countOverlaps(startISO, endISO, prefix) {
  const resp = await calendar.events.list({
    calendarId: CALENDAR_ID,
    timeMin: startISO,
    timeMax: endISO,
    singleEvents: true,
    orderBy: "startTime",
    maxResults: 50
  });

  const items = resp.data.items || [];
  return items.filter(ev => (ev.summary || "").toUpperCase().startsWith(prefix)).length;
}

async function createEvent({ summary, description, startISO, endISO }) {
  const event = {
    summary,
    description,
    start: { dateTime: startISO, timeZone: "America/Mexico_City" },
    end: { dateTime: endISO, timeZone: "America/Mexico_City" }
  };

  const response = await calendar.events.insert({
    calendarId: CALENDAR_ID,
    resource: event
  });

  return response.data;
}

async function bookReservation(session) {
  // Duración fija 60 min para agenda (como tu flujo actual)
  const { startISO, endISO } = buildDateTimes(session.date, session.hour, 60);

  if (session.area === "SPA") {
    const overlaps = await countOverlaps(startISO, endISO, "SPA");
    if (overlaps >= knowledge.spa.rules.maxSimultaneous) {
      return {
        ok: false,
        message:
          "Ese horario ya está llenito 🙈\n" +
          "Para Spa manejamos máximo 2 citas al mismo tiempo.\n\n" +
          "Dime si prefieres:\n• 30 min después\n• 1 hora después\n• otro día\n\n" +
          "¿Qué te acomoda?"
      };
    }
  }

  const summary =
    session.area === "SPA"
      ? `SPA – ${session.service}`
      : `ACADEMIA – ${session.service}`;

  const description =
    `Reserva WhatsApp\n` +
    `Nombre: ${session.name}\n` +
    `Área: ${session.area}\n` +
    `Servicio: ${session.service}\n` +
    `Fecha: ${session.date}\n` +
    `Hora: ${session.hour}`;

  const ev = await createEvent({ summary, description, startISO, endISO });

  return {
    ok: true,
    message:
      `🗓️ Listo, quedó agendado:\n` +
      `• ${session.service}\n` +
      `• ${session.date} ${session.hour}\n\n` +
      `Si necesitas cambiarlo, me dices por aquí 💜`,
    eventId: ev.id
  };
}

module.exports = { bookReservation, buildDateTimes };
