// services/conversation.js
const { askOpenAI } = require("./openai");
const { detectIntent } = require("./logic");
const { getSession, updateSession } = require("./session");
const knowledge = require("./knowledge");
const flows = require("./logic"); // manejará futuros flujos

// Este módulo procesa TODO lo que el usuario dice en WhatsApp
// y decide si responde info, recomienda o entra al flujo de reserva.

async function processMessage(from, userMessage) {
  let session = getSession(from);

  // 1) Analizamos lo que el usuario quiere hacer (intención)
  const intent = detectIntent(userMessage);

  // 2) Si el usuario está en flujo de reserva, lo procesamos primero
  if (session.state === "booking") {
    const stepResponse = await flows.processBookingFlow(from, userMessage);
    return stepResponse;
  }

  // 3) Si la intención es reservar → iniciamos flujo
  if (intent === "booking") {
    session.state = "booking";
    updateSession(from, session);

    return {
      reply:
        "Perfecto 💜 Vamos a apartar tu lugar.\n\n" +
        "¿Cuál es tu nombre completo?"
    };
  }

  // 4) Si la intención es información → dejamos que OpenAI responda conociendo el negocio
  if (intent === "info") {
    const aiResponse = await askOpenAI({
      role: "user",
      content: userMessage,
    });

    return { reply: aiResponse };
  }

  // 5) Si la intención es recomendación → OpenAI usa el conocimiento interno
  if (intent === "recommend") {
    const prompt = `
Eres Soni, experta del Spa y Academia Town Art.
Responde con cariño y autoridad.
Usa esta información del negocio:

${knowledge}

Usuario pregunta: ${userMessage}
    `;

    const aiResponse = await askOpenAI({ role: "user", content: prompt });

    return { reply: aiResponse };
  }

  // 6) Si no detectamos nada → OpenAI responde naturalmente
  const fallback = await askOpenAI({
    role: "user",
    content: `Responde como Soni. Mensaje: ${userMessage}`
  });

  return { reply: fallback };
}

module.exports = { processMessage };
