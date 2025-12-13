require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const Twilio = require("twilio");
const OpenAI = require("openai");
const { google } = require("googleapis");
const { SYSTEM_PROMPT } = require("./prompt");

const app = express();

// ---------------- MIDDLEWARE ----------------
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// ---------------- CLIENTES EXTERNOS ----------------

// Twilio
const twilioClient = Twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

// OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Google Calendar (Service Account)
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

// ---------------- SESIONES EN MEMORIA ----------------

/**
 * sessions guarda el estado de cada número:
 * {
 *   "whatsapp:+52....": {
 *      step: 0..6,
 *      nombre: "",
 *      tipo: "SPA" | "POLE",
 *      servicio: "",
 *      fecha: "AAAA-MM-DD",
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

async function sendWhats(to, text) {
  return twilioClient.messages.create({
    from: process.env.TWILIO_WHATSAPP_NUMBER,
    to,
    body: text,
  });
}

// Construye fecha/hora de inicio y fin (duración fija 60 min)
function buildDateTimes(fecha, hora, durMinutes = 60) {
  const [h, m] = hora.split(":").map(Number);

  const startDateTime = `${fecha}T${hora}:00`;

  let endHour = h;
  let endMin = m + durMinutes;
  if (endMin >= 60) {
    endHour += Math.floor(endMin / 60);
    endMin = endMin % 60;
  }
  if (endHour >= 24) {
    endHour = endHour % 24;
  }

  const endHourStr = String(endHour).padStart(2, "0");
  const endMinStr = String(endMin).padStart(2, "0");
  const endDateTime = `${fecha}T${endHourStr}:${endMinStr}:00`;

  return { startDateTime, endDateTime };
}

async function crearEventoCalendarDesdeSession(session) {
  const { startDateTime, endDateTime } = buildDateTimes(
    session.fecha,
    session.hora,
    60
  );

  const resumen =
    session.tipo === "SPA"
      ? `SPA – ${session.servicio}`
      : `Clase ${session.servicio}`;

  const descripcion =
    `Reserva hecha por: ${session.nombre}\n` +
    `Área: ${session.tipo}\n` +
    `Servicio: ${session.servicio}\n` +
    `Origen: WhatsApp Town Art Bot`;

  const event = {
    summary: resumen,
    description: descripcion,
    start: {
      dateTime: startDateTime,
      timeZone: "America/Mexico_City",
    },
    end: {
      dateTime: endDateTime,
      timeZone: "America/Mexico_City",
    },
  };

  const response = await calendar.events.insert({
    calendarId: CALENDAR_ID,
    resource: event,
  });

  console.log("Evento creado en Calendar:", response.data.id);
  return response.data;
}

// ---------------- RUTAS BÁSICAS ----------------

app.get("/", (req, res) => {
  res.send("Town Art Bot está corriendo ✅");
});

// Test de Google Calendar
app.get("/test-calendar", async (req, res) => {
  try {
    await googleAuth.getClient();

    const now = new Date();
    const in1h = new Date(now.getTime() + 60 * 60 * 1000);

    const event = {
      summary: "Prueba Town Art Bot",
      description: "Evento de prueba creado desde el bot",
      start: {
        dateTime: now.toISOString(),
        timeZone: "America/Mexico_City",
      },
      end: {
        dateTime: in1h.toISOString(),
        timeZone: "America/Mexico_City",
      },
    };

    const response = await calendar.events.insert({
      calendarId: CALENDAR_ID,
      resource: event,
    });

    console.log("Evento de prueba creado:", response.data);
    res.send("✅ Evento de prueba creado correctamente en Google Calendar.");
  } catch (error) {
    console.error("Error creando evento de prueba en Google Calendar:", error);
    res
      .status(500)
      .send(
        "Error creando evento de prueba en Google Calendar:\n\n" +
          (error.message || JSON.stringify(error, null, 2))
      );
  }
});

// ---------------- WEBHOOK WHATSAPP ----------------

app.post("/whatsapp-webhook", async (req, res) => {
  const from = req.body.From; // "whatsapp:+52155..."
  const body = (req.body.Body || "").trim();
  const lower = body.toLowerCase();
  const lowerNoAccents = lower.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  console.log("Mensaje entrante:", from, body);

  const session = getSession(from);

  try {
    const quiereReservar =
      lower.includes("cita") ||
      lower.includes("agendar") ||
      lower.includes("reservar") ||
      lower.includes("reserva") ||
      lower.includes("clase");

    // ---------- FLUJO DE RESERVA ----------
    if (session.step > 0 || quiereReservar) {
      // Paso 0 → iniciar flujo
      if (session.step === 0) {
        session.step = 1;
        await sendWhats(
          from,
          "Perfecto, te ayudo a agendar en Town Art 💜\n\n¿A nombre de quién hacemos la reserva? (Escribe tu nombre completo)"
        );
        return res.sendStatus(200);
      }

      // Paso 1: nombre
      if (session.step === 1) {
        session.nombre = body;
        session.step = 2;
        await sendWhats(
          from,
          `Gracias, ${session.nombre} 🤍\n\n¿La reserva es para el *SPA* o para una *CLASE DE POLE*? (Escribe SPA o POLE)`
        );
        return res.sendStatus(200);
      }

      // Paso 2: tipo
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
            "Perfecto, SPA 💆‍♀️\n\n¿Qué servicio te interesa? Ejemplo: limpieza facial profunda, masaje relajante, drenaje linfático, despigmentación, valoración, etc."
          );
        } else {
          await sendWhats(
            from,
            "Perfecto, CLASE DE POLE 🩰\n\n¿Qué clase te interesa? Ejemplo: Pole Fitness, Flying Pole, Flexi (flexibilidad), Floorwork o Acrobacia."
          );
        }

        return res.sendStatus(200);
      }

      // Paso 3: servicio
      if (session.step === 3) {
        session.servicio = body;
        session.step = 4;
        await sendWhats(
          from,
          "Genial ✨\n\n¿Para qué día quieres tu cita? Escríbelo en formato AAAA-MM-DD.\nEjemplo: 2025-12-15."
        );
        return res.sendStatus(200);
      }

      // Paso 4: fecha
      if (session.step === 4) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(body)) {
          await sendWhats(
            from,
            "Para evitar errores, escribe la fecha así: AAAA-MM-DD.\nEjemplo: 2025-12-15."
          );
          return res.sendStatus(200);
        }

        session.fecha = body;
        session.step = 5;
        await sendWhats(
          from,
          "¿A qué hora te gustaría? Escribe la hora en formato 24 horas.\nEjemplo: 18:00."
        );
        return res.sendStatus(200);
      }

      // Paso 5: hora
      if (session.step === 5) {
        if (!/^\d{2}:\d{2}$/.test(body)) {
          await sendWhats(
            from,
            "Escribe la hora así: HH:MM en formato 24 horas.\nEjemplo: 18:00."
          );
          return res.sendStatus(200);
        }

        session.hora = body;
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

      // Paso 6: confirmación + CREAR EVENTO EN CALENDAR
      if (session.step === 6) {
        if (lowerNoAccents.startsWith("si")) {
          console.log("Reserva confirmada:", session);

          try {
            const event = await crearEventoCalendarDesdeSession(session);

            await sendWhats(
              from,
              "Listo 💜 Tu cita quedó registrada.\n" +
                "También la agendé en nuestro calendario interno 🗓️.\n" +
                "Si necesitas cambiar algo, solo escríbeme por aquí."
            );

            console.log("Evento guardado con id:", event.id);
          } catch (calendarError) {
            console.error(
              "Error al crear el evento en Calendar:",
              calendarError
            );

            await sendWhats(
              from,
              "Tu cita quedó registrada conmigo, pero tuve un problemita al guardarla en el calendario interno.\n" +
                "El equipo la revisará manualmente y te confirmará cualquier ajuste."
            );
          }

          // Reiniciar flujo
          sessions[from] = { step: 0 };
        } else {
          session.step = 4;
          await sendWhats(
            from,
            "Perfecto, vamos a ajustar tu cita 😊\n\n" +
              "Primero dime de nuevo la *fecha* en formato AAAA-MM-DD.\n" +
              "Ejemplo: 2025-12-15."
          );
        }

        return res.sendStatus(200);
      }
    }

    // ---------- RESPUESTA NORMAL CON IA ----------
    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: body },
      ],
    });

    const respuestaIA =
      completion.choices[0].message.content ||
      "Lo siento, no entendí muy bien tu mensaje. ¿Puedes repetirlo de otra forma? 😊";

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

// ---------------- INICIO SERVIDOR ----------------

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor escuchando en el puerto ${PORT}`);
});
