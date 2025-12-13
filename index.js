require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const Twilio = require("twilio");
const OpenAI = require("openai");
const { SYSTEM_PROMPT } = require("./prompt");

const app = express();

// Para leer los datos que manda Twilio (form-urlencoded)
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// Cliente de Twilio
const twilioClient = Twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

// Cliente de OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Ruta de prueba en navegador
app.get("/", (req, res) => {
  res.send("Town Art Bot está corriendo ✅");
});

// Webhook de WhatsApp
app.post("/whatsapp-webhook", async (req, res) => {
  const from = req.body.From;   // ejemplo: "whatsapp:+52155..."
  const body = req.body.Body || "";   // texto que escribió la persona

  console.log("Mensaje entrante:", from, body);

  try {
    // 1) Llamar a OpenAI para generar la respuesta
    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: body },
      ],
    });

    const respuestaIA = completion.choices[0].message.content || "Lo siento, no entendí muy bien tu mensaje. ¿Puedes repetirlo de otra forma? 😊";

    // 2) Enviar la respuesta por WhatsApp
    await twilioClient.messages.create({
      from: process.env.TWILIO_WHATSAPP_NUMBER,
      to: from,
      body: respuestaIA,
    });

    res.status(200).send("OK");
  } catch (error) {
    console.error("Error en el webhook:", error);

    // Mensaje de emergencia al usuario si algo falla
    try {
      await twilioClient.messages.create({
        from: process.env.TWILIO_WHATSAPP_NUMBER,
        to: from,
        body: "Ups, tuve un problema para responderte. ¿Puedes intentar de nuevo en unos minutos, por favor? 💜",
      });
    } catch (e) {
      console.error("Error enviando mensaje de error:", e);
    }

    res.sendStatus(500);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor escuchando en el puerto ${PORT}`);
});
