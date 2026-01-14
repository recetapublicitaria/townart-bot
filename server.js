require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const store = require("./services/sessionStore");
const { sendMessage } = require("./services/twilio");
const { chatReply } = require("./services/openai");
const { tryStartFlow } = require("./services/sofiaFlow");
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
  "quiero clase", "quiero pole", "quiero spa"
];

app.get("/", (req, res) => res.send("Town Art Bot ✅"));

app.post("/whatsapp-webhook", async (req, res) => {
  const from = req.body.From;
  const msg = (req.body.Body || "").trim();
  const t = norm(msg);

  let session = store.get(from);

  try {
    // 1) RESET para pruebas
    if (t === "tania reset" || t === "reset" || t === "reiniciar" || t === "borrar") {
      store.reset(from);
      await sendMessage(from, "Listo 💜 Reinicié la conversación. ¿Cómo puedo apoyarte hoy?");
      return res.sendStatus(200);
    }

    // 2) Saludo inicial (siempre presentarse)
    if (!session.greeted) {
      store.set(from, { greeted: true });
      await sendMessage(from, "Hola 😊 Soy *Tania* de Town Art 💜 ¿Cómo puedo apoyarte hoy?");
      // NO regresamos; dejamos que también procese el msg actual
      session = store.get(from);
    }

    // 3) Detectar si debemos activar flujo de reserva
    const wantsBooking =
      START_FLOW_KW.some(k => t.includes(k)) ||
      t === "si quiero agendar" ||
      t.startsWith("si quiero") ||
      t.includes("agenda");

    // 4) Actualizar “pista” de área según conversación
    const spaHints = ["acne","acné","facial","limpieza","manchas","despigment","masaje","drenaje","reductivo","estrias","celulitis","depil", "piel"];
    const poleHints = ["pole","flying","flexi","floorwork","acroba","clase"];
    if (spaHints.some(k => t.includes(k))) store.set(from, { lastAreaHint: "SPA" });
    if (poleHints.some(k => t.includes(k))) store.set(from, { lastAreaHint: "POLE" });

    session = store.get(from);

    // 5) Si el usuario pide agendar → activar flujo
    if (!session.active && wantsBooking) {
      store.set(from, { active: true, step: 0 });
      await sendMessage(from, "Claro 💜 ¿a nombre de quién agendamos?");
      return res.sendStatus(200);
    }

    // 6) Si estamos en flujo → seguir flujo
    if (session.active) {
      const reply = await tryStartFlow(from, msg, session);
      if (reply) await sendMessage(from, reply);
      return res.sendStatus(200);
    }

    // 7) Respuestas rápidas sin IA (para ahorrar tokens)
    if (t.includes("ubic") || t.includes("direccion") || t.includes("dirección")) {
      await sendMessage(from, `📍 ${knowledge.brand.address}\n\n¿Te paso también la ubicación en Google Maps?`);
      return res.sendStatus(200);
    }

    if (t.includes("horario")) {
      await sendMessage(from, `🕒 Horario general:\n${knowledge.hours.general}\n\nSpa recomendado:\n${knowledge.hours.spaRecommended}`);
      return res.sendStatus(200);
    }

    if (t.includes("pole") && (t.includes("horario") || t.includes("dias") || t.includes("días"))) {
      await sendMessage(from, knowledge.poleScheduleText);
      return res.sendStatus(200);
    }

    // 8) Fuera de reserva: IA (venta + info)
    const ai = await chatReply(msg, session);
    if (ai) await sendMessage(from, ai);

    return res.sendStatus(200);
  } catch (err) {
    console.error("❌ ERROR EN WEBHOOK:", err);
    // Mensaje corto (sin “OK”)
    await sendMessage(from, "Uy 😥 tuve un detallito. ¿Me lo repites en un mensajito, porfa?");
    return res.sendStatus(200);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Servidor activo en el puerto", PORT));
