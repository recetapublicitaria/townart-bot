const { google } = require("googleapis");

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

// 🟣 Verifica si ya existe una cita en ese mismo horario
async function isSlotAvailable(fecha, hora) {
  const start = `${fecha}T${hora}:00`;
  const end = `${fecha}T${hora}:59`;

  const events = await calendar.events.list({
    calendarId: process.env.GOOGLE_CALENDAR_ID,
    timeMin: new Date(start).toISOString(),
    timeMax: new Date(end).toISOString(),
    singleEvents: true,
    orderBy: "startTime",
  });

  return events.data.items.length === 0;
}

// 🟣 Crea la cita real
async function createCalendarEvent({ nombre, tipo, servicio, fecha, hora }) {
  const start = `${fecha}T${hora}:00`;
  const end = `${fecha}T${hora}:59`;

  const summary =
    tipo === "SPA"
      ? `SPA · ${servicio}`
      : `Clase · ${servicio}`;

  const description =
    `Cliente: ${nombre}\n` +
    `Área: ${tipo}\n` +
    `Servicio: ${servicio}\n` +
    `Agendado por SONI Bot`;

  const event = {
    summary,
    description,
    start: { dateTime: start, timeZone: "America/Mexico_City" },
    end: { dateTime: end, timeZone: "America/Mexico_City" },
  };

  const response = await calendar.events.insert({
    calendarId: process.env.GOOGLE_CALENDAR_ID,
    resource: event,
  });

  return response.data;
}

module.exports = { createCalendarEvent, isSlotAvailable };
