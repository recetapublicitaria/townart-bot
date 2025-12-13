// index.js
require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const Twilio = require("twilio");
const OpenAI = require("openai");
const { google } = require("googleapis");
const { SYSTEM_PROMPT } = require("./prompt");

const app = express();

// -------------------- MIDDLEWARE --------------------
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// -------------------- TWILIO ------------------------
const twilioClient = Twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

async function sendWhats(to, text, delayMs = 700) {
  // Pausa pequeña para que no se sienta tan robótico
  await new Promise((resolve) => setTimeout(resolve, delayMs));

  return twilioClient.messages.create({
    from: process.env.TWILIO_WHATSAPP_NUMBER,
    to,
    body: text,
  });
}

// -------------------- OPENAI ------------------------
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// -------------------- GOOGLE CALENDAR --------------
const calendarAuth = new google.auth.JWT(
  process.env.GOOGLE_CLIENT_EMAIL,
  null,
  process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
  ["https://www.googleapis.com/auth/calendar"]
);

const calendar = google.calendar({ version: "v3", auth: calendarAuth });
const TIMEZONE = "America/Mexico_City";
const CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID;

// Crea evento en Calendar usando la info de la sesión
async function createCalendarEvent(session) {
  await calendarAuth.authorize();

  const isValoracion =
    session.servicio &&
    session.servicio.toLowerCase().includes("valoracion");

  const durationMinutes = isValoracion ? 30 : 60;

  const [h, m] = session.hora.split(":").map(Number);
  const start = new Date(`${session.fecha}T${session.hora}:00`);
  const end = new Date(start.getTime() + durationMinutes * 60000);

  const summaryPrefix = session.tipo === "SPA" ? "Spa" : "Clase";
  const summary = `${summaryPrefix} - ${session.servicio} (${session.nombre})`;

  const description =
    `Reserva creada desde WhatsApp.\n` +
    `Nombre: ${session.nombre}\n` +
    `Área: ${session.tipo}\n` +
    `Servicio: ${session.servicio}\n` +
    `WhatsApp: ${session.from}`;

  await calendar.events.insert({
    calendarId: CALENDAR_ID,
    requestBody: {
      summary,
      description,
      start: {
        dateTime: start.toISOString(),
        timeZone: TIMEZONE,
      },
      end: {
        dateTime: end.toISOString(),
        timeZone: TIMEZONE,
      },
    },
  });
}

// Ruta de prueba Calendar (la que ya probaste)
app.get("/test-calendar", async (req, res) => {
  try {
    await calendarAuth.authorize();

    const start = new Date();
    const end = new Date(start.getTime() + 30 * 60000);

    await calendar.events.insert({
      calendarId: CALENDAR_ID,
      requestBody: {
        summary: "Prueba Town Art Bot",
        description: "Evento de prueba creado desde /test-calendar",
        start: { dateTime: start.toISOString(), timeZone: TIMEZONE },
        end: { dateTime: end.toISOString(), timeZone: TIMEZONE },
      },
    });

    res.send("✅ Evento de prueba creado correctamente en Google Calendar.");
  } catch (err) {
    console.error("Error creando evento de prueba:", err);
    res.send("Error creando evento de prueba en Google Calendar.");
  }
});

// -------------------- HORARIOS DE CLASES ------------

// 0 Dom, 1 Lun, ..., 6 Sáb
const classSchedules = {
  pole: {
    1: ["11:00", "18:00", "19:00"], // Lunes
    2: ["11:00", "20:15"],          // Martes
    3: ["11:00", "18:00", "19:00"], // Miércoles
    4: ["10:00", "20:30"],          // Jueves
    5: ["11:00", "18:00", "19:00"], // Viernes
    6: ["10:00", "11:00"],          // Sábado
  },
  flying: {
    4: ["18:00"],                   // Jueves
    5: ["12:30"],                   // Viernes
    6: ["13:00"],                   // Sábado
  },
  flexi: {
    2: ["10:00"],                   // Martes
  },
  floorwork: {
    2: ["19:00"],                   // Martes
  },
  acrobacia: {
    4: ["19:00"],                   // Jueves
  },
};

function getClassKey(servicio) {
  const s = servicio.toLowerCase();
  if (s.includes("flying")) return "flying";
  if (s.includes("flexi")) return "flexi";
  if (s.includes("floor")) return "floorwork";
  if (s.includes("acro")) return "acrobacia";
  return "pole"; // default Pole Fitness
}

function getScheduleDescription(classKey) {
  switch (classKey) {
    case "pole":
      return (
        "Horarios de *Pole Fitness*:\n" +
        "- Lunes: 11:00, 18:00, 19:00\n" +
        "- Martes: 11:00, 20:15\n" +
        "- Miércoles: 11:00, 18:00, 19:00\n" +
        "- Jueves: 10:00, 20:30\n" +
        "- Viernes: 11:00, 18:00, 19:00\n" +
        "- Sábado: 10:00, 11:00"
      );
    case "flying":
      return (
        "Horarios de *Flying Pole*:\n" +
        "- Jueves: 18:00\n" +
        "- Viernes: 12:30\n" +
        "- Sábado: 13:00"
      );
    case "flexi":
      return "Horario de *Flexibilidad*: Martes 10:00.";
    case "floorwork":
      return "Horario de *Floorwork*: Martes 19:00.";
    case "acrobacia":
      return "Horario de *Acrobacia*: Jueves 19:00.";
    default:
      return "";
  }
}

function getDayFromDateString(dateStr) {
  const d = new Date(`${dateStr}T12:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  return d.getDay();
}

function getClassSlotsForDate(classKey, dateStr) {
  const day = getDayFromDateString(dateStr);
  if (day === null) return [];
  const byDay = classSchedules[classKey];
  if (!byDay) return [];
  return byDay[day] || [];
}

// -------------------- PARSE FECHA/HORA --------------
function parseDateFlexible(text) {
  const clean = text.trim();

  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) return clean;

  // dd/mm/yyyy o dd-mm-yyyy
  const m = clean.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (m) {
    const dd = m[1].padStart(2, "0");
    const mm = m[2].padStart(2, "0");
    const yyyy = m[3];
    return `${yyyy}-${mm}-${dd}`;
  }

  return null;
}

function parseTimeFlexible(text) {
  const clean = text.trim().toLowerCase().replace(".", "");

  // HH:MM 24h
  if (/^\d{2}:\d{2}$/.test(clean)) return clean;

  const m = clean.match(/(\d{1,2})(?::(\d{1,2}))?\s*(am|pm)?/);
  if (!m) return null;

  let h = parseInt(m[1], 10);
  let min = m[2] ? parseInt(m[2], 10) : 0;
  const ampm = m[3];

  if (ampm === "pm" && h < 12) h += 12;
  if (ampm === "am" && h === 12) h = 0;

  if (h < 0 || h > 23 || min < 0 || min > 59) return null;

  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

// -------------------- SESIONES EN MEMORIA -----------
/**
 * sessions[numeroWhats] = {
 *   step,
 *   greeted,
 *   nombre,
 *   tipo,
 *   servicio,
 *   fecha,
 *   hora,
 *   classKey,
 *   slots
 * }
 */
const sessions = {};

function getSession(from) {
  if (!sessions[from]) {
    sessions[from] = {
      step: 0,
      greeted: false,
      nombre: null,
    };
  }
  return sessions[from];
}

// -------------------- RUTAS BÁSICAS -----------------
app.get("/", (req, res) => {
  res.send("Town Art Bot está corriendo ✅");
});

// -------------------- WEBHOOK WHATSAPP --------------
app.post("/whatsapp-webhook", async (req, res) => {
  const from = req.body.From;
  const body = (req.body.Body || "").trim();
  const lower = body.toLowerCase();
  const lowerNoAccents = lower.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  console.log("Mensaje entrante:", from, body);

  const session = getSession(from);
  session.from = from;

  try {
    // Saludo inicial SOLO una vez
    if (!session.greeted && session.step === 0) {
      session.greeted = true;
      await sendWhats(
        from,
        "Hola, soy Soni de Town Art 💜\n" +
          "Estoy al pendiente de spa y clases de pole.\n" +
          "¿Cómo puedo apoyarte hoy?"
      );
      res.sendStatus(200);
      return;
    }

    // Palabras que disparan flujo de reserva
    const reservaKeywords = [
      "cita",
      "agendar",
      "agenda",
      "reservar",
      "reserva",
      "clase",
      "pole",
      "spa",
      "facial",
      "masaje",
      "flying",
    ];
    const quiereReservar = reservaKeywords.some((k) =>
      lower.includes(k)
    );

    // ------------ FLUJO DE RESERVA ------------
    if (session.step > 0 || quiereReservar) {
      // Paso 0 – iniciar
      if (session.step === 0) {
        if (!session.nombre) {
          session.step = 1;
          await sendWhats(
            from,
            "Perfecto, te ayudo a agendar ✨\n\n¿A nombre de quién hacemos la reserva? (Escribe tu nombre completo)"
          );
        } else {
          session.step = 2;
          await sendWhats(
            from,
            `Perfecto, ${session.nombre} 💜\n\n¿La reserva es para el *SPA* o para una *CLASE DE POLE*? (Escribe SPA o POLE)`
          );
        }
        res.sendStatus(200);
        return;
      }

      // Paso 1 – nombre
      if (session.step === 1) {
        session.nombre = body;
        session.step = 2;
        await sendWhats(
          from,
          `Gracias, ${session.nombre} 🤍\n\n¿La reserva es para el *SPA* o para una *CLASE DE POLE*? (Escribe SPA o POLE)`
        );
        res.sendStatus(200);
        return;
      }

      // Paso 2 – tipo (SPA / POLE)
      if (session.step === 2) {
        if (lower.includes("spa")) {
          session.tipo = "SPA";
        } else if (lower.includes("pole")) {
          session.tipo = "POLE";
        } else {
          await sendWhats(
            from,
            "Solo para confirmar, ¿la reserva es para *SPA* o para una *CLASE DE POLE*?"
          );
          res.sendStatus(200);
          return;
        }

        session.step = 3;

        if (session.tipo === "SPA") {
          await sendWhats(
            from,
            "Perfecto, Spa 💆‍♀️\n\nCuéntame qué servicio te interesa. Ejemplo:\n" +
              "- Limpieza facial profunda\n" +
              "- Hidratante\n" +
              "- Despigmentante\n" +
              "- Masaje relajante\n" +
              "- Drenaje linfático\n" +
              "- Despigmentación corporal\n" +
              "- Consulta de valoración\n\nEscríbelo con tus palabras y yo lo entiendo 🙂"
          );
        } else {
          await sendWhats(
            from,
            "Perfecto, clase de Pole 🩰\n\n¿Qué clase estás buscando?\n" +
              "- Pole Fitness\n" +
              "- Flying Pole\n" +
              "- Flexibilidad (Flexi)\n" +
              "- Floorwork\n" +
              "- Acrobacia"
          );
        }

        res.sendStatus(200);
        return;
      }

      // Paso 3 – servicio / clase
      if (session.step === 3) {
        session.servicio = body;

        if (session.tipo === "SPA") {
          // Siempre sugerir valoración al inicio si es tratamiento
          if (
            !lowerNoAccents.includes("valoracion") &&
            !lowerNoAccents.includes("valoración")
          ) {
            await sendWhats(
              from,
              "Para tratamientos de rostro o cuerpo normalmente empezamos con una *consulta de valoración con especialista* 🩺\n" +
                "La valoración cuesta $200 y dura aprox. 30 min, ahí revisamos tu piel/cuerpo y armamos tu plan.\n\n" +
                "De todos modos, agendamos el servicio que me comentas y en cabina te orientamos bien."
            );
          }

          session.step = 4;
          await sendWhats(
            from,
            "¿Para qué día quieres tu cita?\n" +
              "Puedes escribirme la fecha así:\n" +
              "- 2025-12-15\n" +
              "- 15/12/2025\n" +
              "- 15-12-2025"
          );
          res.sendStatus(200);
          return;
        } else {
          // POLE: fijar clase y mostrar horarios fijos
          session.classKey = getClassKey(session.servicio);
          const desc = getScheduleDescription(session.classKey);

          await sendWhats(
            from,
            desc +
              "\n\nLas clases son en esos horarios fijos, no podemos agendar a cualquier hora 🕒.\n" +
              "¿Para qué *día* quieres apartar tu lugar? Escríbeme la fecha (por ejemplo 2025-12-15 o 15/12/2025)."
          );

          session.step = 4;
          res.sendStatus(200);
          return;
        }
      }

      // Paso 4 – fecha
      if (session.step === 4) {
        const fecha = parseDateFlexible(body);
        if (!fecha) {
          await sendWhats(
            from,
            "Para anotarla bien, ¿me ayudas con la fecha con día, mes y año?\n" +
              "Ejemplo: 2025-12-15 o 15/12/2025 🙂"
          );
          res.sendStatus(200);
          return;
        }

        session.fecha = fecha;

        if (session.tipo === "POLE") {
          const classKey = session.classKey || "pole";
          const slots = getClassSlotsForDate(classKey, fecha);

          if (!slots.length) {
            const desc = getScheduleDescription(classKey);
            await sendWhats(
              from,
              "Ese día no tenemos clase de esa modalidad 🥺\n\n" +
                desc +
                "\n\n¿Te gustaría elegir otro día?"
            );
            // nos quedamos en paso 4 para que envíe otra fecha
            res.sendStatus(200);
            return;
          }

          session.slots = slots;
          session.step = 5;

          await sendWhats(
            from,
            `Para ese día tenemos estos horarios:\n` +
              `• ${slots.join("\n• ")}\n\n` +
              "¿En cuál te gustaría apartar tu lugar?"
          );
          res.sendStatus(200);
          return;
        } else {
          // SPA
          session.step = 5;
          await sendWhats(
            from,
            "¿A qué hora te gustaría?\n" +
              "Puedes escribirme algo como:\n" +
              "- 11:00\n" +
              "- 4 pm\n" +
              "- 7:30 pm"
          );
          res.sendStatus(200);
          return;
        }
      }

      // Paso 5 – hora
      if (session.step === 5) {
        if (session.tipo === "POLE" && session.slots && session.slots.length) {
          const parsedTime = parseTimeFlexible(body);
          let chosen = null;

          if (parsedTime && session.slots.includes(parsedTime)) {
            chosen = parsedTime;
          } else {
            // Intentar por coincidencia simple
            chosen = session.slots.find((slot) =>
              body.includes(slot.slice(0, 2))
            );
          }

          if (!chosen) {
            await sendWhats(
              from,
              `Elige uno de estos horarios, por fa:\n• ${session.slots.join(
                "\n• "
              )}`
            );
            res.sendStatus(200);
            return;
          }

          session.hora = chosen;
        } else {
          // SPA
          const parsedTime = parseTimeFlexible(body);
          if (!parsedTime) {
            await sendWhats(
              from,
              "Para la hora, puedes escribirme algo como:\n" +
                "- 11:00\n" +
                "- 4 pm\n" +
                "- 7:30 pm"
            );
            res.sendStatus(200);
            return;
          }
          session.hora = parsedTime;
        }

        session.step = 6;

        const resumen =
          `Te resumo la reserva:\n\n` +
          `Nombre: ${session.nombre}\n` +
          `Área: ${session.tipo}\n` +
          `Servicio / Clase: ${session.servicio}\n` +
          `Fecha: ${session.fecha}\n` +
          `Hora: ${session.hora}\n\n` +
          `¿Es correcto? Responde *SI* para confirmar o *NO* para ajustar.`;

        await sendWhats(from, resumen);
        res.sendStatus(200);
        return;
      }

      // Paso 6 – confirmación
      if (session.step === 6) {
        if (lowerNoAccents.startsWith("si")) {
          console.log("Reserva confirmada:", session);

          try {
            await createCalendarEvent(session);
            await sendWhats(
              from,
              "Listo 💜 Tu cita quedó apartada y ya está en nuestra agenda interna.\n" +
                "Tienes tolerancia de 15 minutos; cualquier cambio me escribes por aquí."
            );
          } catch (err) {
            console.error("Error al crear evento en Calendar:", err);
            await sendWhats(
              from,
              "Tu cita quedó registrada conmigo 💜\n" +
                "Tuve un detallito al mandarla al calendario, pero el equipo la revisará manualmente y te confirma por este medio."
            );
          }

          // Reinicio de flujo pero conservando nombre y saludo
          const nombreGuardado = session.nombre;
          sessions[from] = {
            step: 0,
            greeted: true,
            nombre: nombreGuardado,
          };
        } else {
          session.step = 4;
          await sendWhats(
            from,
            "Perfecto, ajustamos tu cita 😊\n\n" +
              "Dime de nuevo la *fecha* con día, mes y año.\n" +
              "Ejemplo: 2025-12-15 o 15/12/2025."
          );
        }

        res.sendStatus(200);
        return;
      }
    }

    // ------------ RESPUESTA NORMAL CON IA ------------
    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: body },
      ],
    });

    let respuestaIA =
      completion.choices[0].message.content ||
      "No me quedó muy claro lo que necesitas, ¿me cuentas un poquito más? 🙂";

    const r = respuestaIA.trim().toLowerCase();
    if (["ok", "oki", "va", "vale", "claro"].includes(r)) {
      respuestaIA =
        "Perfecto, lo tengo anotado 😊\n" +
        "Si quieres, también puedo ayudarte a agendar una cita o explicarte algún servicio.";
    }

    await sendWhats(from, respuestaIA);
    res.sendStatus(200);
  } catch (error) {
    console.error("Error en el webhook:", error);

    try {
      await sendWhats(
        from,
        "Ups, tuve un problema para responderte. ¿Me ayudas intentando de nuevo en unos minutos, por favor? 💜"
      );
    } catch (e) {
      console.error("Error enviando mensaje de error:", e);
    }

    res.sendStatus(500);
  }
});

// -------------------- SERVIDOR ----------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor escuchando en el puerto ${PORT}`);
});
