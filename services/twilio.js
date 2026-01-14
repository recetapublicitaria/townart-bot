const Twilio = require("twilio");

const twilioClient = Twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function sendMessage(to, text, opts = {}) {
  const delayMs = typeof opts.delayMs === "number"
    ? opts.delayMs
    : 600 + Math.floor(Math.random() * 900); // 0.6–1.5s

  // Simula respuesta humana (pequeña pausa)
  await sleep(delayMs);

  return twilioClient.messages.create({
    from: process.env.TWILIO_WHATSAPP_NUMBER,
    to,
    body: text
  });
}

module.exports = { sendMessage };
