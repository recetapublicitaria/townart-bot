const openai = require("./openai");
const knowledge = require("./knowledge");
const { updateSession } = require("./session");
const { detectIntent } = require("./utils/nlp");

// =============================
// FUNCIÓN PRINCIPAL DE RESPUESTA
// =============================
async function conversationalReply(from, message, session, intent) {
  const user = session.name ? session.name : "cliente";

  // Construimos el prompt avanzado para OpenAI
  const prompt = `
Eres *Soni*, la concierge del Spa + Academia TOWN ART.

Tu estilo:
- Cálida
- Empática
- Profesional
- Amiga motivadora
- Que apapacha pero también guía
- Nunca dices "soy un asistente", hablas como humana real
- Nunca dices "IA", nunca pides formato rígido

Tu meta:
1. Dar información clara del Spa y Academia
2. Recomendar como experta
3. Generar confianza
4. Guiar suavemente hacia agendar, pero sin presionar
5. Detectar intención real del cliente (información, dudas, inseguridad, intención de comprar)
6. Usar tono humano, cálido, cercano

Información:
${knowledge.fullText}

El cliente dijo:
"${message}"

Datos del cliente:
${JSON.stringify(session)}

Intención detectada:
${intent}

Responde como Soni en máximo 4–6 líneas.
No generes pasos de agenda; eso lo maneja sofiaFlow.js.
Si consideras que debería reservar, solo sugiere suavemente.
Si es un tratamiento, recuerda que lo mejor es *valoración*.
Si pregunta por pole, puedes sugerir paquetes o clases ideales.
`;

  const response = await openai.ask(prompt);

  // Marcar si la IA considera que debe iniciar flujo
  if (
    intent === "start_reservation" ||
    response.toLowerCase().includes("te ayudo a agendar") ||
    response.toLowerCase().includes("quieres que agendemos") ||
    response.toLowerCase().includes("quieres reservar")
  ) {
    session.suggestStartFlow = true;
    updateSession(from, session);
  } else {
    session.suggestStartFlow = false;
    updateSession(from, session);
  }

  return response;
}

module.exports = { conversationalReply };
