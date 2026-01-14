const Twilio = require("twilio");

const client = Twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

async function sendWhats(to, body) {
  try {
    await client.messages.create({
      from: process.env.TWILIO_WHATSAPP_NUMBER,
      to,
      body,
    });
  } catch (err) {
    console.error("❌ Error enviando mensaje WhatsApp:", err);
  }
}

module.exports = { sendWhats };
