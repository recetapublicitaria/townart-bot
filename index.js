require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const Twilio = require("twilio");
const OpenAI = require("openai");
const { google } = require("googleapis");
const { SYSTEM_PROMPT } = require("./prompt");

const app = express();

// Para leer los datos que manda Twilio (form-urlencoded)
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// Cliente de Twilio
const twilioClient = Twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

// Cliente de OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ---------------- GOOGLE CALENDAR ----------------

let calendar = null;

function initCalendarSafe() {
  try {
    if (
      !process.env.GOOGLE_CLIENT_EMAIL ||
      !process.env.GOOGLE_PRIVATE_KEY ||
      !process.env.GOOGLE_CALENDAR_ID
    ) {
      console.warn(
        "⚠️ Google Calendar desactivado: faltan variables de entorno (GOOGLE_CLIENT_EMAIL, GOOGLE_PRIVATE_KEY o GOOGLE_CALENDAR_ID)."
      );
      return;
    }

    const jwtClient = new google.auth.JWT(
      process.env.GOOGLE_CLIENT_EMAIL,
      null,
      // Reemplazamos \\n por saltos de línea reales
      process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
      ["https://www.googleapis.com/auth/calendar"]
    );

    calendar = google.calendar({ version: "v3", auth: jwtClient });
    console.log("✅ Google Calendar inicializado correctamente");
  } catch (err) {
    console.error("Error inicializando Google Calendar:", err);
    calendar = null;
  }
}

initCalendarSafe();

async function crearCitaCalendar(session, from) {
  if (!calendar) {
    console.warn(
      "⚠️ Se intentó crear una cita en Calendar, pero el cliente no está configurado."
    );
    return;
  }

  try {
    const timeZone = "America/Mexico_City";

    const [year, month, day] = session.fecha.split("-").map(Number);
    const [hour, minute] = session.hora.split(":").map(Number);

    const start = new Date(Date.UTC(year, month - 1, day, hour, minute));
    const end = new Date(start.getTime() + 60 * 60000); // +60 minutos

    const event = {
      summary: `${session.tipo} - ${session.servicio} - ${session.nombre}`,
      description:
        `Reserva creada desde WhatsApp.\n` +
        `Nombre: ${session.nombre}\n` +
        `Área: ${session.tipo}\n` +
        `Servicio: ${session.servicio}\n` +
        `WhatsApp: ${from}`,
      start: {
        dateTime: start.toISOString(),
        timeZone,
      },
      end: {
        dateTime: end.toISOString(),
        timeZone,
      },
    };

    await calendar.events.insert({
      calendarId: process.env.GOOGLE_CALENDAR_ID,
      requestBody: event,
    });

    console.log("✅ Evento creado en Google Calendar");
  } catch (err) {
    console.error("❌ Error creando evento en Google Calendar:", err);
  }
}

// ---------------- HELPERS FECHA / HORA ----------------

// Devuelve 'YYYY-MM-DD' o null si no entiende
function parseFechaToISO(text) {
  const t = text.trim().toLowerCase();

  // Formato YYYY-MM-DD
  let m = t.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
  if (m) {
    let year = m[1];
    let month = m[2].padStart(2, "0");
    let day = m[3].padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  // Formato DD/MM/YYYY o DD-MM-YYYY
  m = t.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (m) {
    let day = m[1].padStart(2, "0");
    let month = m[2].padStart(2, "0");
    let year = m[3];
    return `${year}-${month}-${day}`;
  }

  // Si no entendimos, devolvemos null para pedir que lo aclaren
  return null;
}

// Devuelve 'HH:MM' 24h o null si no entiende
function par
