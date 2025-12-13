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

async function sendWhats(to, text, delayMs = 600) {
  // pequeña pausa para que no se sienta tan robótico
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
const auth = new google.auth.JWT(
  process.env.GOOGLE_CLIENT_EMAIL,
  null,
  process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
  ["https://www.googleapis.com/auth/calendar"]
);

const calendar = google.calendar({ version: "v3", auth });

// Duración por defecto: 60 min, valoración: 30 min
async function createCalendarEvent(session) {
  const tz = "America/Mexico_City";

  const startDateTime = new Date(`${session.fecha}T${session.hora}:00`);
  const isValoracion = session.servicio
    .toLowerCase()
    .includes("valoración");

  const durationMinutes = isValoracion ? 30 : 60;
  const endDateTime = new Date(
    startDateTime.getTime() + durationMinutes * 60000
  );

  const summaryPrefix =
    session.tipo === "SPA" ? "Spa" : "Clase";

  const summary = `${summaryPrefix} - ${session.servicio} (${session.nombre})`;

  const description =
    `Reserva creada desde WhatsApp.\n` +
    `Nombre: ${session.nombre}\n` +
    `Área: ${session.tipo}\n` +
    `Servicio: ${session.servicio}\n` +
    `WhatsApp: ${session.from}`;

  await calendar.events.insert({
    calendarId: process.env.GOOGLE_CALENDAR_ID,
    requestBody: {
      summary,
      description,
      start: {
        dateTime: startDateTime.toISOString(),
        timeZone: tz,
      },
      end: {
        dateTime: endDateTime.toISOString(),
        timeZone: tz,
      },
    },
  });
}

// Ruta de prueba para Calendar
app.get("/test-calendar", async (req, res) => {
  try {
    await calendar.events.insert({
      calendarId: process.env.GOOGLE_CALENDAR_ID,
      requestBody: {
        summary: "Prueba Town Art Bot",
        description: "Evento de prueba creado desde /test-calendar",
        start: {
          dateTime: new Date().toISOString(),
          timeZone: "America/Mexico_City",
        },
        end: {
          dateTime: new Date(Date.now() + 30 * 60000).toISOString(),
          timeZone: "America/Mexico_City",
        },
      },
    });
    res.send("✅ Evento de prueba creado correctamente en Google Calendar.");
  } catch (err) {
    console.error("Error creando evento de prueba:", err);
    res.send("Error creando evento de prueba en Google Calendar.");
  }
});

// -------------------- SESIONES EN MEMORIA ----------

/**
 * sessions:
 * {
 *   "whatsapp:+52...": {
 *     step: 0..6,
 *     nombre: "Ana",
 *     tipo: "SPA" | "POLE",
 *     servicio: "",
 *     fecha: "YYYY-MM-DD",
 *     hora: "HH:MM",
 *     poleSlots: [...],
 *     greeted: true
 *   }
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

// -------------------- HORARIOS POLE -----------------

// Usamos número de día JS: 0 Dom, 1 Lun, ..., 6 Sáb
const poleScheduleByDay = {
  1: ["11:00", "18:00", "19:00"], // Lunes
  2: ["11:00", "20:15"], // Martes (solo Pole)
  3: ["11:00", "18:00", "19:00"], // Miércoles
  4: ["10:00", "20:30"], // Jueves (Pole Fitness)
  5: ["11:00", "18:00", "19:00"], // Viernes (Pole)
  6: ["10:00", "11:00"], // Sábado (Pole)
  // Domingo no hay clases
};

function getDayFromDateString(dateStr) {
  // Creamos con mediodía para evitar issues de zona
  const d = new Date(`${dateStr}T12:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  return d.getDay(); // 0..6
}

function getPoleSlotsForDate(dateStr) {
  const day = getDayFromDateString(dateStr);
  if (day === null) return [];
  return poleScheduleByDay[day] || [];
}

// -------------------- PARSE FECHA Y HORA ------------

function parseDateFlexible(text) {
  const clean = text.trim();

  // 1) Formato ISO: YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) return clean;

  // 2) dd/mm/yyyy o dd-mm-yyyy
  const m = clean.match(
    /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/
  );
  if (m) {
    let dd = m[1].padStart(2, "0");
    let mm = m[2].padStart(2, "0");
    const yyyy = m[3];
    return `${yyyy}-${mm}-${dd}`;
  }

  return null;
}

function parseTimeFlexible(text) {
  const clean = text.trim().toLowerCase().replace(".", "");
  // 1) HH:MM 24h
  if (/^\d{2}:\d{2}$/.test(clean)) return clean;

  // 2) Variantes: "7", "7 pm", "7:30pm", "11 am"
  const m = clean.match(
    /(\d{1,2})(?::(\d{1,2}))?\s*(am|pm)?/
  );
  if (!m) return null;

  let h = parseInt(m[1], 10);
  let min = m[2] ? parseInt(m[2], 10) : 0;
  const ampm = m[3];

  if (ampm === "pm" && h < 12) h += 12;
  if (ampm === "am" && h === 12) h = 0;

  if (h < 0 || h > 23 || min < 0 || min > 59) return null;

  return `${String(h).padStart(2, "0")}:${String(min).padStart(
    2,
    "0"
  )}`;
}

// -------------------- RUTAS BÁSICAS -----------------

app.get("/", (req, res) => {
  res.send("Town Art Bot está corriendo ✅");
});

// -------------------- WEBHOOK WHATSAPP --------------

app.post("/whatsapp-webhook", async (req, res) => {
  const from = req.body.From; // "whatsapp:+52155..."
  const body = (req.body.Body || "").trim();
  const lower = body.toLowerCase();
  const lowerNoAccents = lower
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  console.log("Mensaje entrante:", from, body);

  const session = getSession(from);
  session.from = from; // por si lo queremos en el evento

  try {
    // Saludo inicial más humano (solo una vez)
    if (!session.greeted && session.step === 0) {
      session.greeted = true;
      await sendWhats(
        from,
        "Hola, soy Soni de Town Art 💜\n" +
          "Estoy al pendiente de spa y clases de pole.\n" +
          "¿Cómo puedo apoyarte hoy?"
      );
      // No hacemos return: dejamos que la IA también responda si el mensaje ya traía info
    }

    // ¿Quieren reservar?
    const quiereReservar =
      lower.includes("cita") ||
      lower.includes("agendar") ||
      lower.includes("reservar") ||
      lower.includes("reserva") ||
      lower.includes("clase");

    // ------------- FLUJO DE RESERVA -------------
    if (session.step > 0 || quiereReservar) {
      // Paso 0 → arrancar flujo
      if (session.step === 0) {
        if (!session.nombre) {
          session.step = 1;
          await sendWhats(
            from,
            "Perfecto, te ayudo a agendar ✨\n\n¿A nombre de quién hacemos la reserva? (Escribe tu nombre completo)"
          );
        } else {
          // Ya conocemos el nombre
          session.step = 2;
          await sendWhats(
            from,
            `Perfecto, ${session.nombre} 💜\n\n¿La reserva es para el *SPA* o para una *CLASE DE POLE*? (Escribe SPA o POLE)`
          );
        }
        res.sendStatus(200);
        return;
      }

      // Paso 1: nombre
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

      // Paso 2: tipo
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
              "- Consulta de valoración\n\nEscríbelo con tus palabras y yo lo entiendo 😊"
          );
        } else {
          await sendWhats(
            from,
            "Perfecto, clase de Pole 🩰\n\n¿Qué clase estás buscando?\n" +
              "- Pole Fitness\n" +
              "- Flying Pole\n" +
              "- Flexibilidad (Flexi)\n" +
              "- Floorwork\n" +
              "- Acrobacia\n\nEscríbeme cuál te interesa."
          );
        }

        res.sendStatus(200);
        return;
      }

      // Paso 3: servicio
      if (session.step === 3) {
        session.servicio = body;
        session.step = 4;

        // Sugerencia de valoración para ciertos tratamientos
        if (session.tipo === "SPA") {
          const s = lowerNoAccents;
          if (
            s.includes("despigment") ||
            s.includes("reductiv") ||
            s.includes("celulit") ||
            s.includes("estria") ||
            s.includes("post") ||
            s.includes("postquir") ||
            s.includes("quirurg") ||
            s.includes("cicatriz")
          ) {
            await sendWhats(
              from,
              "Para ese tipo de tratamiento normalmente empezamos con una *consulta de valoración con especialista* 🩺\n" +
                "La valoración cuesta $200 y dura aprox. 30 min; ahí revisamos tu piel/cuerpo y armamos tu plan.\n\n" +
                "De cualquier forma, vamos a agendar y en cabina te orientamos bien."
            );
          }
        }

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
      }

      // Paso 4: fecha
      if (session.step === 4) {
        const parsedDate = parseDateFlexible(body);
        if (!parsedDate) {
          await sendWhats(
            from,
            "Para anotarlo bien, ¿me ayudas con la fecha con día, mes y año?\n" +
              "Ejemplo: 2025-12-15 o 15/12/2025 🙂"
          );
          res.sendStatus(200);
          return;
        }

        session.fecha = parsedDate;

        // Si es Pole, validamos horarios para ese día
        if (session.tipo === "POLE") {
          const slots = getPoleSlotsForDate(session.fecha);
          if (!slots.length) {
            await sendWhats(
              from,
              "Ese día no tenemos clases de pole programadas 🥺\n\n" +
                "Te cuento rápido cómo están los horarios:\n" +
                "- Lunes, miércoles y viernes: 11:00, 18:00, 19:00\n" +
                "- Martes: 11:00 y 20:15\n" +
                "- Jueves: 10:00 y 20:30\n" +
                "- Sábado: 10:00 y 11:00\n\n" +
                "¿Te gustaría probar con otro día?"
            );
            // seguimos en step 4
            res.sendStatus(200);
            return;
          }

          session.poleSlots = slots;
          session.step = 5;

          await sendWhats(
            from,
            `Para ese día tenemos clases en estos horarios:\n` +
              `• ${slots.join("\n• ")}\n\n` +
              "¿En cuál te gustaría apartar tu lugar?"
          );
          res.sendStatus(200);
          return;
        }

        // Si es Spa → pedimos hora libre
        session.step = 5;
        await sendWhats(
          from,
          "¿A qué hora te gustaría?\n" +
            "Puedes escribirme por ejemplo:\n" +
            "- 11:00\n" +
            "- 4 pm\n" +
            "- 7:30 pm"
        );
        res.sendStatus(200);
        return;
      }

      // Paso 5: hora
      if (session.step === 5) {
        if (session.tipo === "POLE" && session.poleSlots) {
          const chosen = session.poleSlots.find((h) =>
            body.includes(h.slice(0, 2))
          );
          if (!chosen) {
            await sendWhats(
              from,
              `Elige uno de estos horarios, por fa:\n• ${session.poleSlots.join(
                "\n• "
              )}`
            );
            res.sendStatus(200);
            return;
          }

          session.hora = chosen;
        } else {
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
          `Servicio: ${session.servicio}\n` +
          `Fecha: ${session.fecha}\n` +
          `Hora: ${session.hora}\n\n` +
          `¿Es correcto? Responde *SI* para confirmar o *NO* para ajustar.`;

        await sendWhats(from, resumen);
        res.sendStatus(200);
        return;
      }

      // Paso 6: confirmación
      if (session.step === 6) {
        if (lowerNoAccents.startsWith("si")) {
          console.log("Reserva confirmada:", session);

          try {
            await createCalendarEvent(session);
            await sendWhats(
              from,
              "Listo 💜 Tu cita quedó apartada.\n" +
                "También la anoté en nuestro calendario para que no se nos pase.\n\n" +
                "Cualquier cambio o duda, escríbeme por aquí."
            );
          } catch (err) {
            console.error("Error al crear evento en Calendar:", err);
            await sendWhats(
              from,
              "Tu cita quedó registrada conmigo 💜\n" +
                "Tuve un detalle al mandarla al calendario, pero el equipo la revisará y te confirma por este medio."
            );
          }

          // Reiniciamos flujo pero conservamos nombre
          const nombre = session.nombre;
          sessions[from] = {
            step: 0,
            greeted: true,
            nombre,
          };
        } else {
          // Ajustar fecha/hora sin reiniciar todo
          session.step = 4;
          await sendWhats(
            from,
            "Perfecto, vamos a ajustar tu cita 😊\n\n" +
              "Primero dime de nuevo la *fecha* con día, mes y año.\n" +
              "Ejemplo: 2025-12-15 o 15/12/2025."
          );
        }

        res.sendStatus(200);
        return;
      }
    }

    // ------------- RESPUESTA NORMAL CON IA -------------
    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: body },
      ],
    });

    const respuestaIA =
      completion.choices[0].message.content ||
      "No me quedó muy claro lo que necesitas, ¿me cuentas un poquito más? 🙂";

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
