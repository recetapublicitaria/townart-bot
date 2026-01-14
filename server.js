require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const { handleIncomingMessage } = require("./services/sofia");

const app = express();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

// TEST ROUTE
app.get("/", (req, res) => {
  res.send("Town Art Bot (SONI) activo 🩷✨");
});

// WHATSAPP WEBHOOK
app.post("/whatsapp-webhook", async (req, res) => {
  try {
    const from = req.body.From;
    const body = req.body.Body?.trim() || "";

    await handleIncomingMessage(from, body);
    res.sendStatus(200);

  } catch (error) {
    console.error("❌ Error en webhook:", error);
    res.sendStatus(500);
  }
});

// RUN SERVER
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("🚀 Servidor en puerto:", PORT));
