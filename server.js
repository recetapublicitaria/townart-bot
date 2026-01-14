require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const { handleIncomingMessage } = require("./services/sofia");

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

app.get("/", (req, res) => {
  res.send("TownArt Bot (SONI) activo 🩷✨");
});

app.post("/whatsapp-webhook", async (req, res) => {
  try {
    const from = req.body.From;
    const body = req.body.Body?.trim() || "";

    await handleIncomingMessage(from, body);

    res.sendStatus(200);
  } catch (err) {
    console.error("❌ Error webhook:", err);
    res.sendStatus(500);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Servidor en puerto ${PORT}`));
