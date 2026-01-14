require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");

const sessionStore = require("./services/sessionStore");
const { sendMessage } = require("./services/twilio");
const { analyzeMessage } = require("./services/openai");
const { tryStartFlow } = require("./services/sofiaFlow");

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

const KEYWORDS_START_FLOW = [
  "agendar", "cita", "reservar", "quiero una cita", "tomar clase",
  "quiero clase", "quiero pole", "quiero spa", "servicio"
];

// ===========================================================
//                     WEBHOOK DE WHATSAPP
// ===========================================================
app.post("/whatsapp-webhook", async (req, res) => {
  const from = req.body.From;
  const msg = (req.body.Body || "").trim();
  const msgLower = msg.toLowerCase();

  let session = sessionStore.get(from); // ← YA FUNCIONA

  try {
    // ------------------------------------------------------
    // RESET / BORRAR SESIÓN
    // ------------------------------------------------------
    const resetWords = [
      "reset", "reiniciar", "borrar", "olvidar",
      "nuevo", "empezar", "empezar de cero",
      "limpiar", "olvida todo"
    ];

    if (resetWords.includes(msgLower)) {
      sessionStore.reset(from);
      await sendMessage(from, "✨ Conversación reiniciada. ¿En qué puedo ayudarte hoy?");
      return res.sendStatus(200);
    }

    // ------------------------------------------------------
    // DETECTAR INTENCIÓN
    // ------------------------------------------------------
    const intent = await analyzeMessage(msg);

    // ------------------------------------------------------
    // DETECTAR INICIO DE FLUJO DE RESERVA
    // ------------------------------------------------------
    const isStartFlow =
      KEYWORDS_START_FLOW.some(k => msgLower.includes(k)) ||
      intent === "reservar";

    if (!session.flowActive && isStartFlow) {
      session.flowActive = true;
      session.step = 0;
      sessionStore.set(from, session);

      await sendMessage(from, "Claro 💜 ¿A nombre de quién agendamos?");
      return res.sendStatus(200);
    }

    // ------------------------------------------------------
    // FLUJO DE RESERVA ACTIVO
    // ------------------------------------------------------
    if (session.flowActive) {
      const response = await tryStartFlow(from, msg, session, intent);

      if (response) {
        await sendMessage(from, response);
      }

      return res.sendStatus(200);
    }

    // ------------------------------------------------------
    // RESPUESTA NORMAL (CHAT)
    // ------------------------------------------------------
    const aiReply = await analyzeMessage(msg, { mode: "chat" });
    await sendMessage(from, aiReply);

    res.sendStatus(200);

  } catch (err) {
    console.error("❌ ERROR EN WEBHOOK:", err);

    await sendMessage(
      from,
      "Ups... tuve un problema para responder 😢 ¿Puedes intentar de nuevo?"
    );

    res.sendStatus(200);
  }
});

// ===========================================================
app.get("/", (req, res) => {
  res.send("SOFIA BOT ✔️ Server Running");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Servidor activo en el puerto", PORT);
});
