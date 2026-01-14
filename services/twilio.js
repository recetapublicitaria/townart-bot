const Twilio = require("twilio");

const client = Twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

async function sendMessage(to, body) {
  return client.messages.create({
    from: process.env.TWILIO_WHATSAPP_NUMBER,
    to,
    body
  });
}

module.exports = { sendMessage };
