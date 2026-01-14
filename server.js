require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const { handleMessage } = require("./services/sofia");
const { sendWhats } = require("./services/twilio");

const app = express();

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// ------------------ RUTA PRINCIPAL ------------------
app.get("/", (req, res) => {
  res.send("Soni AI Concierge está vivo y funcionando 💜");
});

// ------------------ WEBHOOK TWILIO ------------------
app.post("/whatsapp-webhook", async (req, res) => {
  const from = req.body.From;
  const msg = req.body.Body ?? "";

  try {
    const reply = await handleMessage(from, msg);
    await sendWhats(from, reply);
    res.sendStatus(200);
  } catch (e) {
    console.error("❌ Error procesando mensaje:", e);

    await sendWhats(
      from,
      "Ups… tuve un pequeño problema al responderte 😢 ¿Puedes intentar de nuevo?"
    );

    res.sendStatus(500);
  }
});

// ------------------ INICIO SERVIDOR ------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log(`🚀 Soni escuchando en puerto ${PORT}`)
);
