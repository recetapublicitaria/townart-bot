// index.js
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
 *      hora: "HH:MM",
 *      lastArea: "SPA" | "POLE"
 *   }
 * }
 */
const sessions = {};

function getSession(from) {
  if (!sessions[from]) {
    sessions[from] = { step: 0, lastArea: null };
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

// ---------------- HELPERS DE FECHA/HORA ----------------

function formatDateYMD(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getWeekdayName(dateStr) {
  const d = new Date(`${dateStr}T12:00:00`);
  if (Number.isNaN(d.getTime())) return "";
  const names = [
    "domingo",
    "lunes",
    "martes",
    "miércoles",
    "jueves",
    "viernes",
    "sábado",
  ];
  return names[d.getDay()];
}

// Fecha flexible: "hoy", "mañana", "el lunes", "15/12", "15 de diciembre", "2025-12-15"
function parseFlexibleDate(text) {
  const t = text.toLowerCase().trim();
  const now = new Date();

  // hoy / mañana
  if (t === "hoy") {
    return formatDateYMD(now);
  }
  if (t === "mañana" || t === "manana") {
    const d = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    return formatDateYMD(d);
  }

  // ISO directo
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) {
    return t;
  }

  // día de la semana
  const dayMap = {
    domingo: 0,
    lunes: 1,
    martes: 2,
    miércoles: 3,
    miercoles: 3,
    jueves: 4,
    viernes: 5,
    sábado: 6,
    sabado: 6,
  };

  for (const [name, index] of Object.entries(dayMap)) {
    if (t.includes(name)) {
      const todayIndex = now.getDay();
      let diff = index - todayIndex;
      if (diff <= 0) diff += 7; // siempre el siguiente día (no hoy)
      const d = new Date(now.getTime() + diff * 24 * 60 * 60 * 1000);
      return formatDateYMD(d);
    }
  }

  // dd/mm[/yyyy] o dd-mm[-yyyy]
  const m1 = t.match(/(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?/);
  if (m1) {
    const day = parseInt(m1[1], 10);
    const month = parseInt(m1[2], 10);
    let year = m1[3] ? parseInt(m1[3], 10) : now.getFullYear();
    if (year < 100) year += 2000;

    let d = new Date(year, month - 1, day);
    if (d < now && !m1[3]) {
      d = new Date(year + 1, month - 1, day);
    }
    return formatDateYMD(d);
  }

  // "15 de diciembre", "15 diciembre"
  const m2 = t.match(/(\d{1,2})\s*(de\s+)?([a-záéíóúñ]+)/);
  if (m2) {
    const day = parseInt(m2[1], 10);
    const monthName = m2[3];
    const monthMap = {
      enero: 1,
      febrero: 2,
      marzo: 3,
      abril: 4,
      mayo: 5,
      junio: 6,
      julio: 7,
      agosto: 8,
      septiembre: 9,
      setiembre: 9,
      octubre: 10,
      noviembre: 11,
      diciembre: 12,
    };
    let month = null;
    for (const [key, val] of Object.entries(monthMap)) {
      if (monthName.startsWith(key)) {
        month = val;
        break;
      }
    }
    if (month) {
      let year = now.getFullYear();
      let d = new Date(year, month - 1, day);
      if (d < now) {
        d = new Date(year + 1, month - 1, day);
      }
      return formatDateYMD(d);
    }
  }

  return null;
}

// Hora flexible: "18:00", "6 pm", "7:30pm", "7"
function parseFlexibleTime(text) {
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
    // --- 1) Detectar si el mensaje habla de SPA o de CLASES (para recordar contexto) ---
    const spaKeywords = [
      "spa",
      "facial",
      "masaje",
      "corporal",
      "despigment",
      "acne",
      "acné",
      "estria",
      "estría",
      "celulitis",
      "depilacion",
      "depilación",
      "valoracion",
      "valoración",
      "manchas",
      "pigment",
    ];

    const poleKeywords = [
      "pole",
      "flying",
      "flexi",
      "floorwork",
      "acrobacia",
      "aereo",
      "aéreo",
      "clase de pole",
      "clases de pole",
    ];

    if (spaKeywords.some((k) => lower.includes(k))) {
      session.lastArea = "SPA";
    } else if (poleKeywords.some((k) => lower.includes(k))) {
      session.lastArea = "POLE";
    }

    // --- 2) Detectar si realmente quiere reservar/agendar ---
    const isAffirmative =
      lower === "si" || lower === "sí" || lower === "claro" || lower === "va";

    const quiereReservar =
      lower.includes("quiero agendar") ||
      lower.includes("quiero reservar") ||
      lower.includes("quiero una cita") ||
      lower.includes("quiero mi cita") ||
      lower.includes("agendar cita") ||
      lower.includes("agendar una cita") ||
      lower.includes("reservar cita") ||
      lower.includes("reservar una clase") ||
      lower.includes("reservar clase") ||
      lower.includes("apartar lugar") ||
      lower.includes("apartar mi lugar") ||
      // Caso especial: ya veníamos hablando de algo (Spa o Pole),
      // y la persona solo responde "sí".
      (session.step === 0 && session.lastArea && isAffirmative);

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
        // No preguntamos aquí; lo resolvemos en el bloque de paso 2
      }

      // Paso 2: tipo (SPA / POLE)
      if (session.step === 2) {
        // Si este mensaje menciona spa/pole, usamos eso
        if (!session.tipo) {
          if (lower.includes("spa")) {
            session.tipo = "SPA";
          } else if (lower.includes("pole")) {
            session.tipo = "POLE";
          }
        }

        // Si no lo dijo ahora pero ya traíamos contexto, lo usamos
        if (!session.tipo && session.lastArea) {
          session.tipo = session.lastArea;
        }

        // Si aún así no sabemos, preguntamos
        if (!session.tipo) {
          await sendWhats(
            from,
            `Gracias, ${session.nombre} 🤍\n\n¿La reserva es para el *SPA* o para una *CLASE DE POLE*? (Escribe SPA o POLE)`
          );
          return res.sendStatus(200);
        }

        // Ya sabemos el tipo, pasamos a servicio
        session.step = 3;

        if (session.tipo === "SPA") {
          await sendWhats(
            from,
            `Gracias, ${session.nombre} 🤍\n\nAgendamos en el *SPA* 💆‍♀️\n\n¿Qué servicio te interesa? Por ejemplo:\n` +
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
            `Gracias, ${session.nombre} 🤍\n\nAgendamos una *CLASE DE POLE* 🩰\n\n¿Qué clase te interesa? Ejemplo:\n` +
              "- Pole Fitness\n" +
              "- Flying Pole\n" +
              "- Flexi (flexibilidad)\n" +
              "- Floorwork\n" +
              "- Acrobacia"
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
          "Genial ✨\n\n¿Para qué día quieres tu cita?\n" +
            "Puedes escribirme algo como:\n" +
            "- hoy\n" +
            "- mañana\n" +
            "- el lunes\n" +
            "- 15/12\n" +
            "- 15 de diciembre\n\n" +
            "Yo lo convierto internamente para la agenda 🗓️"
        );
        return res.sendStatus(200);
      }

      // Paso 4: fecha (flexible)
      if (session.step === 4) {
        const parsedDate = parseFlexibleDate(body);
        if (!parsedDate) {
          await sendWhats(
            from,
            "Para anotarlo bien, ¿me ayudas con la fecha?\n" +
              "Puedes poner, por ejemplo:\n" +
              "- hoy\n" +
              "- mañana\n" +
              "- el viernes\n" +
              "- 15/12\n" +
              "- 15 de diciembre"
          );
          return res.sendStatus(200);
        }

        session.fecha = parsedDate;
        session.step = 5;

        await sendWhats(
          from,
          "¿A qué hora te gustaría?\n" +
            "Puedes escribirme algo como:\n" +
            "- 11:00\n" +
            "- 4 pm\n" +
            "- 7:30 pm"
        );
        return res.sendStatus(200);
      }

      // Paso 5: hora (flexible)
      if (session.step === 5) {
        const parsedTime = parseFlexibleTime(body);
        if (!parsedTime) {
          await sendWhats(
            from,
            "Para la hora, puedes escribirme algo como:\n" +
              "- 11:00\n" +
              "- 4 pm\n" +
              "- 7:30 pm"
          );
          return res.sendStatus(200);
        }

        session.hora = parsedTime;
        session.step = 6;

        const dayName = getWeekdayName(session.fecha);
        const resumen =
          `Perfecto, te resumo la reserva:\n\n` +
          `Nombre: ${session.nombre}\n` +
          `Área: ${session.tipo}\n` +
          `Servicio: ${session.servicio}\n` +
          `Fecha: ${session.fecha}${
            dayName ? " (" + dayName + ")" : ""
          }\n` +
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
              "Tu cita quedó registrada conmigo, pero tuve un detallito al guardarla en el calendario interno.\n" +
                "El equipo la revisará manualmente y te confirmará cualquier ajuste."
            );
          }

          // Reiniciar flujo
          sessions[from] = { step: 0, lastArea: null };
        } else {
          session.step = 4;
          await sendWhats(
            from,
            "Perfecto, vamos a ajustar tu cita 😊\n\n" +
              "Primero dime de nuevo la fecha.\n" +
              "Puedes poner:\n" +
              "- hoy\n" +
              "- mañana\n" +
              "- el viernes\n" +
              "- 15/12\n" +
              "- 15 de diciembre"
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

    let respuestaIA =
      completion.choices[0].message.content ||
      "Lo siento, no entendí muy bien tu mensaje. ¿Puedes repetirlo de otra forma? 😊";

    const r = respuestaIA.trim().toLowerCase();
    if (["ok", "oki", "va", "claro"].includes(r)) {
      respuestaIA =
        "Perfecto, lo tengo anotado 😊\n" +
        "Si quieres, también puedo ayudarte a agendar una cita o explicarte algún servicio.";
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

// ---------------- INICIO SERVIDOR ----------------

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor escuchando en el puerto ${PORT}`);
});
