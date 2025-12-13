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
function parseHoraTo24(text) {
  let t = text.trim().toLowerCase();
  t = t.replace(/\s+/g, " ");

  // 24h: 18:30, 9:05, etc.
  let m = t.match(/^(\d{1,2}):(\d{2})$/);
  if (m) {
    let hh = parseInt(m[1], 10);
    let mm = parseInt(m[2], 10);
    if (hh >= 0 && hh <= 23 && mm >= 0 && mm <= 59) {
      return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
    }
  }

  // Formato "6 pm", "6pm", "10 am", etc.
  m = t.match(/^(\d{1,2})(:(\d{2}))?\s*(am|pm)$/);
  if (m) {
    let hh = parseInt(m[1], 10);
    let mm = m[3] ? parseInt(m[3], 10) : 0;
    const ampm = m[4];

    if (hh >= 1 && hh <= 12 && mm >= 0 && mm <= 59) {
      if (ampm === "pm" && hh !== 12) hh += 12;
      if (ampm === "am" && hh === 12) hh = 0;
      return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
    }
  }

  return null;
}

// ---------------- SESIONES EN MEMORIA ----------------

/**
 * sessions guarda el estado de cada número:
 * {
 *   "whatsapp:+52....": {
 *      step: 0..6,
 *      nombre: "",
 *      tipo: "SPA" | "POLE",
 *      servicio: "",
 *      fecha: "YYYY-MM-DD",
 *      hora: "HH:MM"
 *   }
 * }
 */
const sessions = {};

function getSession(from) {
  if (!sessions[from]) {
    sessions[from] = { step: 0 };
  }
  return sessions[from];
}

// pequeño delay para que no responda tan robótico
async function sendWhats(to, text) {
  await new Promise((resolve) => setTimeout(resolve, 1500)); // 1.5s
  return twilioClient.messages.create({
    from: process.env.TWILIO_WHATSAPP_NUMBER,
    to,
    body: text,
  });
}

// ---------------- RUTAS ----------------

app.get("/", (req, res) => {
  res.send("Town Art Bot está corriendo ✅");
});

// Webhook de WhatsApp
app.post("/whatsapp-webhook", async (req, res) => {
  const from = req.body.From; // ejemplo: "whatsapp:+52155..."
  const body = (req.body.Body || "").trim();
  const lower = body.toLowerCase();
  const lowerNoAccents = lower.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  console.log("Mensaje entrante:", from, body);

  const session = getSession(from);

  try {
    // Detectar si la persona quiere reservar
    const quiereReservar =
      lower.includes("cita") ||
      lower.includes("agendar") ||
      lower.includes("reservar") ||
      lower.includes("reserva") ||
      lower.includes("clase");

    // Si ya estamos en flujo o el mensaje suena a reserva
    if (session.step > 0 || quiereReservar) {
      // ------- Paso 0 → iniciar flujo -------
      if (session.step === 0) {
        session.step = 1;
        await sendWhats(
          from,
          "Perfecto, te ayudo a agendar en Town Art 💜\n\n¿A nombre de quién hacemos la reserva? (Escribe tu nombre completo)"
        );
        return res.sendStatus(200);
      }

      // ------- Paso 1: nombre -------
      if (session.step === 1) {
        session.nombre = body;
        session.step = 2;
        await sendWhats(
          from,
          `Gracias, ${session.nombre} 🤍\n\n¿La reserva es para el *SPA* o para una *CLASE DE POLE*? (Escribe SPA o POLE)`
        );
        return res.sendStatus(200);
      }

      // ------- Paso 2: tipo (SPA / POLE) -------
      if (session.step === 2) {
        if (lower.includes("spa")) {
          session.tipo = "SPA";
        } else if (lower.includes("pole")) {
          session.tipo = "POLE";
        } else {
          await sendWhats(
            from,
            "Solo para confirmar, ¿la reserva es para *SPA* o para *CLASE DE POLE*?"
          );
          return res.sendStatus(200);
        }

        session.step = 3;

        if (session.tipo === "SPA") {
          await sendWhats(
            from,
            "Perfecto, SPA 💆‍♀️\n\n¿Qué servicio te interesa? Por ejemplo: valoración, limpieza facial profunda, masaje relajante, drenaje linfático, despigmentación, etc."
          );
        } else {
          await sendWhats(
            from,
            "Perfecto, CLASE DE POLE 🩰\n\n¿Qué clase te interesa? Por ejemplo: Pole Fitness, Flying Pole, Flexi (flexibilidad), Floorwork o Acrobacia."
          );
        }

        return res.sendStatus(200);
      }

      // ------- Paso 3: servicio -------
      if (session.step === 3) {
        session.servicio = body;
        session.step = 4;
        await sendWhats(
          from,
          "Genial ✨\n\n¿Para qué día quieres tu cita? Puedes escribirme algo como:\n" +
            "- 2025-12-15\n" +
            "- 15/12/2025"
        );
        return res.sendStatus(200);
      }

      // ------- Paso 4: fecha -------
      if (session.step === 4) {
        const fechaISO = parseFechaToISO(body);
        if (!fechaISO) {
          await sendWhats(
            from,
            "No alcancé a entender bien la fecha 🙈\n¿Me la escribes con día, mes y año? Por ejemplo: 15/12/2025."
          );
          return res.sendStatus(200);
        }

        session.fecha = fechaISO;
        session.step = 5;
        await sendWhats(
          from,
          "¿A qué hora te gustaría? Puedes escribirme, por ejemplo:\n" +
            "- 18:00\n" +
            "- 6 pm\n" +
            "- 6:30 pm"
        );
        return res.sendStatus(200);
      }

      // ------- Paso 5: hora -------
      if (session.step === 5) {
        const hora24 = parseHoraTo24(body);
        if (!hora24) {
          await sendWhats(
            from,
            "No me quedó clara la hora 🙈\n¿Me la escribes así: 18:00, 6 pm, 6:30 pm, 10 am, etc.?"
          );
          return res.sendStatus(200);
        }

        session.hora = hora24;
        session.step = 6;

        const resumen =
          `Perfecto, te resumo la reserva:\n\n` +
          `Nombre: ${session.nombre}\n` +
          `Área: ${session.tipo}\n` +
          `Servicio: ${session.servicio}\n` +
          `Fecha: ${session.fecha}\n` +
          `Hora: ${session.hora}\n\n` +
          `¿Es correcto? Responde *SI* para confirmar o *NO* para ajustar fecha y hora.`;

        await sendWhats(from, resumen);
        return res.sendStatus(200);
      }

      // ------- Paso 6: confirmación -------
      if (session.step === 6) {
        if (lowerNoAccents.startsWith("si")) {
          console.log("Reserva confirmada:", session);

          // Crear evento en Google Calendar
          await crearCitaCalendar(session, from);

          await sendWhats(
            from,
            "Listo 💜 Tu cita quedó registrada en la agenda de Town Art.\n" +
              "Tienes tolerancia de 15 minutos; cualquier cambio nos avisas por aquí."
          );

          // Reiniciamos flujo
          sessions[from] = { step: 0 };
        } else {
          // NO → solo corregimos fecha y hora, no reiniciamos todo
          session.step = 4;
          await sendWhats(
            from,
            "Perfecto, vamos a ajustar tu cita 😊\n\n" +
              "Primero dime de nuevo la fecha. Puedes escribirla como 2025-12-15 o 15/12/2025."
          );
        }

        return res.sendStatus(200);
      }
    }

    // --------- RESPUESTA NORMAL CON IA (sin flujo de reserva) ---------
    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: body },
      ],
    });

    let respuestaIA =
      completion.choices[0].message.content ||
      "Lo siento, no entendí muy bien tu mensaje. ¿Puedes repetirlo de otra forma? 😊";

    const lowerResp = respuestaIA.trim().toLowerCase();
    if (
      lowerResp === "ok" ||
      lowerResp === "oki" ||
      lowerResp === "va" ||
      lowerResp === "vale"
    ) {
      respuestaIA =
        "Perfecto, lo tengo anotado 🙌 ¿Te gustaría que veamos horarios o que te explique un poquito más el servicio?";
    }

    await sendWhats(from, respuestaIA);

    res.status(200).send("OK");
  } catch (error) {
    console.error("Error en el webhook:", error);

    try {
      await sendWhats(
        from,
        "Ups, tuve un problema para responderte. ¿Puedes intentar de nuevo en unos minutos, por favor? 💜"
      );
    } catch (e) {
      console.error("Error enviando mensaje de error:", e);
    }

    res.sendStatus(500);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor escuchando en el puerto ${PORT}`);
});
