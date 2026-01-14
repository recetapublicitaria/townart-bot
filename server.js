require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");

const store = require("./services/sessionStore");
const { sendMessage } = require("./services/twilio");

// ✅ Soporta ambas firmas (chatReply o analyzeMessage) para que no truene
const openaiSvc = require("./services/openai");
const chatReply =
  openaiSvc.chatReply ||
  (async (msg, session) => openaiSvc.analyzeMessage(msg, { mode: "chat" }, session));

const intentReply =
  openaiSvc.intentReply ||
  (async (msg) => {
    if (openaiSvc.analyzeMessage) return openaiSvc.analyzeMessage(msg, { mode: "intent" });
    // fallback barato sin IA
    const t = String(msg || "").toLowerCase();
    const keys = ["agendar", "cita", "reserv", "reserva", "apart", "agenda", "quiero una cita", "quiero agendar"];
    return keys.some(k => t.includes(k)) ? "reservar" : "chat";
  });

const { tryStartFlow } = require("./services/sofiaFlow"); // (si tu archivo se llama sofiaFlow.js)
const knowledge = require("./services/knowledge");
const { stripAccents } = require("./services/utils/normalize");

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

function norm(s) {
  return stripAccents(String(s || "").toLowerCase()).trim();
}

// keywords para iniciar reserva
const START_FLOW_KW = [
  "agendar", "cita", "reservar", "reserva",
  "quiero agendar", "quiero una cita", "apartarme",
  "quiero clase", "quiero pole", "quiero spa",
  "agenda", "apartado", "apartarme"
];

// hints para “entender de qué venían hablando”
const spaHints = ["acne","acné","facial","limpieza","manchas","despigment","masaje","drenaje","reductivo","estrias","estrías","celulitis","depil","piel","valoracion","valoración"];
const poleHints = ["pole","flying","flexi","floorwork","acroba","acrobacia","clase"];

app.get("/", (req, res) => res.send("Town Art Bot ✅"));

app.post("/whatsapp-webhook", async (req, res) => {
  const from = req.body.From;
  const msg = (req.body.Body || "").trim();
  const t = norm(msg);

  let session = store.get(from);

  try {
    // 1) RESET para pruebas (palabra clave)
    if (t === "tania reset" || t === "reset" || t === "reiniciar" || t === "borrar" || t === "olvidar") {
      store.reset(from);
      await sendMessage(from, "Listo 💜 Reinicié la conversación. ¿Cómo puedo apoyarte hoy?");
      return res.sendStatus(200);
    }

    // 2) Saludo inicial (siempre presentarse como TANIA)
    if (!session.greeted) {
      store.set(from, { greeted: true });
      await sendMessage(from, "Hola 😊 Soy *Tania* de Town Art 💜 ¿Cómo puedo apoyarte hoy?");
      // NO cortamos aquí: dejamos que el msg actual también se procese
      session = store.get(from);
    }

    // 3) Guardar “pista” de área (para que si ya hablaban de acné, no vuelva a preguntar SPA/POLE)
    if (spaHints.some(k => t.includes(k))) store.set(from, { lastAreaHint: "SPA" });
    if (poleHints.some(k => t.includes(k))) store.set(from, { lastAreaHint: "POLE" });
    session = store.get(from);

    // 4) Respuestas rápidas sin IA (ahorra tokens y evita errores)
    if (t.includes("ubic") || t.includes("direccion") || t.includes("dirección")) {
      await sendMessage(from, `📍 ${knowledge.brand.address}\n\n¿Te paso también la ubicación en Google Maps?`);
      return res.sendStatus(200);
    }

    if (t.includes("horario")) {
      await sendMessage(from, `🕒 Horario general:\n${knowledge.hours.general}\n\nSpa recomendado:\n${knowledge.hours.spaRecommended}`);
      return res.sendStatus(200);
    }

    if ((t.includes("pole") || t.includes("flying") || t.includes("flexi") || t.includes("floorwork") || t.includes("acrob")) &&
        (t.includes("horario") || t.includes("dias") || t.includes("días"))) {
      await sendMessage(from, knowledge.poleScheduleText);
      return res.sendStatus(200);
    }

    // 5) Detectar si debemos activar flujo de reserva
    const wantsBooking =
      START_FLOW_KW.some(k => t.includes(k)) ||
      t === "si quiero agendar" ||
      t.startsWith("si quiero agendar") ||
      t.startsWith("si quiero reservar") ||
      t === "si" || t === "sí";

    // 6) (Opcional) Detectar intención con OpenAI si existe (no rompe si no está)
    const intent = await intentReply(msg); // "reservar" | "chat"

    const shouldStartFlow = !session.active && (wantsBooking || intent === "reservar");

    // 7) Activar flujo cuando el usuario ya dijo que quiere agendar
    if (shouldStartFlow) {
      // Si ya venían hablando de SPA/POLE, lo guardamos para que NO lo vuelva a preguntar luego
      const presetArea = session.lastAreaHint || null;

      store.set(from, {
        active: true,
        step: 0,
        // si tu flujo usa estos campos, ya los dejamos listos
        area: presetArea,
      });

      await sendMessage(from, "Claro 💜 ¿a nombre de quién agendamos?");
      return res.sendStatus(200);
    }

    // 8) Si estamos en flujo → seguir flujo de reserva
    session = store.get(from);
    if (session.active) {
      const reply = await tryStartFlow(from, msg, session, intent);
      if (reply) await sendMessage(from, reply);
      return res.sendStatus(200);
    }

    // 9) Fuera de reserva: IA (venta + info)
    const ai = await chatReply(msg, session);
    if (ai) await sendMessage(from, ai);

    return res.sendStatus(200);
  } catch (err) {
    console.error("❌ ERROR EN WEBHOOK:", err);
    // Mensaje corto (sin "OK")
    await sendMessage(from, "Uy 😥 tuve un detallito. ¿Me lo repites en un mensajito, porfa?");
    return res.sendStatus(200);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Servidor activo en el puerto", PORT));
