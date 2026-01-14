const { google } = require("googleapis");

const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: process.env.GOOGLE_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n")
  },
  scopes: ["https://www.googleapis.com/auth/calendar"]
});

const calendar = google.calendar({ version: "v3", auth });

async function bookReservation(session) {
  try {
    const start = `${session.date}T${session.hour}:00`;
    const end = `${session.date}T${session.hour.replace(/:..$/, ":59")}:00`;

    const event = {
      summary: `${session.area} – ${session.service}`,
      description: `Cliente: ${session.name}`,
      start: { dateTime: start, timeZone: "America/Mexico_City" },
      end: { dateTime: end, timeZone: "America/Mexico_City" }
    };

    const created = await calendar.events.insert({
      calendarId: process.env.GOOGLE_CALENDAR_ID,
      resource: event
    });

    return { ok: true, message: "Tu cita quedó registrada 🗓️" };
  } catch (e) {
    console.error("❌ Calendar error:", e);
    return { ok: false, message: "Tu cita se registró, pero hubo un error con el calendario." };
  }
}

module.exports = { bookReservation };
