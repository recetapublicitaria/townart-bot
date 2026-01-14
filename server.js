require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");

const { sendWhats } = require("./services/twilio");
const { conversationalReply } = require("./services/conversation");
const { processReservationFlow } = require("./sofiaFlow");
const { getSession, updateSession, resetSession } = require("./services/session");
const { normalize } = require("./services/utils/normalize");
const { detectIntentAdvanced } = require("./services/utils/language");

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// ================================
//          RUTA DE PRUEBA
// ================================
app.get("/", (req, res) => {
  res.send("💜 Town Art Bot está corriendo y listo para apapachar");
});

// ================================
//      WEBHOOK WHATSAPP
// ================================
app.post("/whatsapp-webhook", async (req, res) => {
  const from = req.body.From;
  const msg = (req.body.Body || "").trim();

  if (!from || !msg) return res.sendStatus(200);

  // RESET COMANDO PARA PRUEBAS
  if (normalize(msg) === "*reset" || normalize(msg) === "reiniciar") {
    resetSession(from);
    await sendWhats(from, "Reiniciamos todo 💜 ¿en qué puedo ayudarte ahora?");
    return res.sendStatus(200);
  }

  const session = getSession(from);
  const intent = detectIntentAdvanced(msg);

  try {
    // ====================================
    // 1) ¿HAY UN FLUJO DE RESERVA ACTIVO?
    // ====================================
    if (session.flowActive) {
      const result = await processReservationFlow(from, msg, session);
      return res.sendStatus(200);
    }

    // ====================================
    // 2) DETECTAR SI DEBE ACTIVARSE FLUJO
    // ====================================
    if (intent === "reservation") {
      session.flowActive = true;
      updateSession(from, session);
      await sendWhats(from, "Claro 💜 ¿a nombre de quién agendamos?");
      return res.sendStatus(200);
    }

    // ====================================
    // 3) RESPUESTA NATURAL CONVERSACIONAL
    // ====================================
    const reply = await conversationalReply(from, msg, session, intent);

    // Si la IA considera que debe iniciar reserva
    if (session.suggestStartFlow && !session.flowActive) {
      await sendWhats(from, reply);
      await sendWhats(
        from,
        "Si quieres, puedo ayudarte a agendar tu cita 💜 ¿quieres hacerlo ahora?"
      );
      return res.sendStatus(200);
    }

    await sendWhats(from, reply);
    res.sendStatus(200);
  } catch (err) {
    console.error("❌ Error en webhook:", err);
    await sendWhats(
      from,
      "Ups… tuve un pequeño problema para responder 😢 ¿Puedes intentar de nuevo?"
    );
    res.sendStatus(200);
  }
});

// ====================================
//          INICIAR SERVIDOR
// ====================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor escuchando en puerto ${PORT}`);
});
