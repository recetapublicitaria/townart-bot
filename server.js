require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");

const { get: getSession, set: updateSession, reset: resetSession } =
  require("./services/sessionStore");

const { sendMessage } = require("./services/twilio");
const { analyzeMessage } = require("./services/openai");
const { tryStartFlow } = require("./services/sofiaFlow");

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

const RESET_WORDS = ["reset", "reiniciar", "borrar", "olvidar"];
const FLOW_WORDS = [
  "agendar", "cita", "reservar", "quiero una cita",
  "quiero clase", "quiero pole", "quiero spa", "servicio"
];

app.post("/whatsapp-webhook", async (req, res) => {
  const from = req.body.From;
  const msg = (req.body.Body || "").trim();
  const lower = msg.toLowerCase();

  let session = getSession(from);

  try {
    if (RESET_WORDS.includes(lower)) {
      resetSession(from);
      await sendMessage(from, "✨ Conversación reiniciada. ¿En qué puedo ayudarte hoy?");
      return res.sendStatus(200);
    }

    const intent = await analyzeMessage(msg);

    const startFlow =
      FLOW_WORDS.some(w => lower.includes(w)) ||
      intent === "reservar";

    if (!session.flowActive && startFlow) {
      session.flowActive = true;
      session.step = 0;
      updateSession(from, session);
      await sendMessage(from, "💜 ¿Cuál es tu nombre?");
      return res.sendStatus(200);
    }

    if (session.flowActive) {
      const reply = await tryStartFlow(from, msg, session, intent);
      if (reply) await sendMessage(from, reply);
      return res.sendStatus(200);
    }

    // Chat libre:
    const aiReply = await analyzeMessage(msg, { mode: "chat" });
    await sendMessage(from, aiReply);

    res.sendStatus(200);

  } catch (err) {
    console.error("❌ ERROR:", err);
    await sendMessage(from, "Ups... tuve un problema para responder 😢 ¿Puedes intentar de nuevo?");
    return res.sendStatus(200);
  }
});

app.get("/", (req, res) => res.send("SOFIA BOT ✔️ Running"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Servidor activo en puerto", PORT));
