require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const Twilio = require("twilio");

const { generalResponse } = require("./services/conversation");
const { processBookingFlow } = require("./services/logic");
const { checkReset, resetSession, getSession } = require("./services/session");

const app = express();

// Middleware requerido por Twilio
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// Twilio WhatsApp Client
const twilioClient = Twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

// -----------------------------
// Enviar mensaje por WhatsApp
// -----------------------------
async function sendWhats(to, text) {
  await twilioClient.messages.create({
    from: process.env.TWILIO_WHATSAPP_NUMBER,
    to,
    body: text
  });
}

// -----------------------------
// RUTA DE PRUEBA
// -----------------------------
app.get("/", (req, res) => {
  res.send("Town Art SuperBot está corriendo 💜🤖✨");
});

// -----------------------------
// WEBHOOK PRINCIPAL DE WHATSAPP
// -----------------------------
app.post("/whatsapp-webhook", async (req, res) => {
  const from = req.body.From;
  const message = (req.body.Body || "").trim();

  console.log("💬 Mensaje entrante:", from, message);

  try {
    // 1️⃣ Revisar si pidió RESET
    if (checkReset(message)) {
      resetSession(from);
      await sendWhats(
        from,
        "Perfecto 💜 reinicié todo.\n\n¿En qué te puedo ayudar hoy?"
      );
      return res.sendStatus(200);
    }

    // 2️⃣ Revisar si está en un flujo de reserva
    const session = getSession(from);
    if (
      session.nombre ||
      session.tipo ||
      session.servicio ||
      session.fecha ||
      session.hora
    ) {
      const response = await processBookingFlow(from, message);

      if (response && response.reply) {
        await sendWhats(from, response.reply);
      }
      return res.sendStatus(200);
    }

    // 3️⃣ Si NO está en flujo de reserva → respuesta normal
    const response = await generalResponse(from, message);

    if (response && response.reply) {
      await sendWhats(from, response.reply);
    }

    res.sendStatus(200);
  } catch (err) {
    console.error("🔥 ERROR EN WEBHOOK:", err);

    await sendWhats(
      from,
      "Ups 💜 tuve un problema para responder.\n¿Puedes intentar de nuevo?"
    );

    res.sendStatus(500);
  }
});

// -----------------------------
// INICIAR SERVIDOR
// -----------------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
});
