const Twilio = require("twilio");

const client = Twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

async function sendWhats(to, message) {
  try {
    await client.messages.create({
      from: process.env.TWILIO_WHATSAPP_NUMBER,
      to,
      body: message
    });
  } catch (err) {
    console.error("❌ Error enviando WhatsApp:", err);
  }
}

module.exports = { sendWhats };
