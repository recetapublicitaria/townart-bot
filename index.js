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

// ---------------- MEMORIA DE CONVERSACIÓN ----------------

// sessions guarda el historial de mensajes por número de WhatsApp:
// {
//   "whatsapp:+52...": [
//      { role: "user", content: "..." },
//      { role: "assistant", content: "..." },
//      ...
//   ]
// }
const sessions = {};

// pequeña función para simular que Soni tarda tantito en contestar
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ---------------- RUTAS ----------------

app.get("/", (req, res) => {
  res.send("Town Art Bot está corriendo ✅");
});

// Webhook de WhatsApp
app.post("/whatsapp-webhook", async (req, res) => {
  const from = req.body.From; // ejemplo: "whatsapp:+52155..."
  const body = (req.body.Body || "").trim();

  console.log("Mensaje entrante:", from, body);

  // Inicializar historial para este número si no existe
  if (!sessions[from]) {
    sessions[from] = [];
  }

  const history = sessions[from];

  try {
    // Añadimos el mensaje del usuario al historial
    history.push({ role: "user", content: body });

    // Construimos la conversación: system + últimos ~10 mensajes
    const conversation = [
      { role: "system", content: SYSTEM_PROMPT },
      ...history.slice(-10),
    ];

    // Llamada a OpenAI
    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: conversation,
    });

    let respuestaIA =
      completion.choices[0]?.message?.content?.trim() ||
      "Perdón, no alcancé a entender bien tu mensaje. ¿Me lo puedes escribir de otra forma?";

    // Evitar respuestas tipo "ok" muy cortas
    const lowerResp = respuestaIA.toLowerCase();
    if (
      lowerResp === "ok" ||
      lowerResp === "oki" ||
      lowerResp === "va" ||
      lowerResp === "vale"
    ) {
      respuestaIA =
        "Perfecto, lo tengo anotado 🙌 ¿Te gustaría que veamos horarios o que te explique un poquito más el servicio?";
    }

    // Simular que Soni tarda un poco en responder (1.5 segundos)
    await sleep(1500);

    // Enviamos la respuesta por WhatsApp
    await twilioClient.messages.create({
      from: process.env.TWILIO_WHATSAPP_NUMBER,
      to: from,
      body: respuestaIA,
    });

    // Guardamos la respuesta en el historial
    history.push({ role: "assistant", content: respuestaIA });

    // Respondemos a Twilio
    res.status(200).send("OK");
  } catch (error) {
    console.error("Error en el webhook:", error);

    // Mensaje de emergencia al usuario si algo falla
    try {
      await twilioClient.messages.create({
        from: process.env.TWILIO_WHATSAPP_NUMBER,
        to: from,
        body:
          "Tuve un problemita para responderte justo ahora 😔. Intenta escribirme de nuevo en unos minutos, por favor.",
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
