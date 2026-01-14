const OpenAI = require("openai");

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Detecta intención (reservar, preguntar, etc.)
async function analyzeMessage(message, options = { mode: "intent" }) {
  try {
    const prompt = options.mode === "chat"
      ? `Responde de forma amable y breve como "Soni" de Town Art. Usuario: ${message}`
      : `Clasifica la intención del usuario en una palabra: reservar, preguntar o desconocido.\nMensaje: ${message}`;

    const completion = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [{ role: "user", content: prompt }],
    });

    return completion.choices[0].message.content.trim().toLowerCase();
  } catch (error) {
    console.error("Error en analyzeMessage:", error);
    return "desconocido";
  }
}

module.exports = {
  analyzeMessage,
};
