const OpenAI = require("openai");

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ----------------------------
// ANALIZADOR DE INTENCIÓN
// ----------------------------
async function detectIntent(message) {
  try {
    const completion = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        {
          role: "system",
          content:
            "Devuelve SOLO una palabra que identifique la intención del usuario. Opciones: reservar, info, saludo, pregunta, despedida, otro."
        },
        { role: "user", content: message }
      ],
      max_tokens: 2,
      temperature: 0
    });

    return completion.choices[0].message.content.trim().toLowerCase();
  } catch (err) {
    console.error("❌ Error detectIntent:", err);
    return "otro";
  }
}

// ----------------------------
// RESPUESTA NATURAL (CHAT LIBRE)
// ----------------------------
async function chatResponse(message) {
  try {
    const completion = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        {
          role: "system",
          content:
            "Eres Sofía, concierge cálida y experta del Spa y Academia Town Art. Responde corto, amable y profesional."
        },
        { role: "user", content: message }
      ],
      max_tokens: 150,
      temperature: 0.8
    });

    return completion.choices[0].message.content.trim();
  } catch (err) {
    console.error("❌ Error chatResponse:", err);
    return "Lo siento, tuve un problema al responder 😢";
  }
}

// ----------------------------
// FUNCIÓN PRINCIPAL
// ----------------------------
async function analyzeMessage(message, options = {}) {
  if (options.mode === "chat") {
    return chatResponse(message);
  }
  return detectIntent(message);
}

module.exports = { analyzeMessage };
