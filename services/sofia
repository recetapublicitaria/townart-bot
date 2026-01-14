const { getSession, resetSession } = require("./session");
const { detectIntent } = require("./utils/nlp");
const { conversationalReply } = require("./conversation");
const { tryStartFlow } = require("./sofiaFlow");
const { normalize } = require("./utils/normalize");

// Palabra clave para pruebas: limpia todo
const RESET_KEYWORD = "RESET TODO";

async function handleMessage(from, rawMessage) {
  const message = normalize(rawMessage);
  const session = getSession(from);

  // -------------------------
  // 1) LIMPIAR TODO EL ESTADO
  // -------------------------
  if (message.includes(RESET_KEYWORD.toLowerCase())) {
    resetSession(from);
    return "Listo ✨ Reinicié toda la conversación. ¿En qué puedo ayudarte ahora?";
  }

  // -------------------------
  // 2) DETECTAR INTENCIÓN
  // -------------------------
  const intent = detectIntent(message, session);

  // Guardamos en memoria del usuario el último mensaje
  session.lastMessage = message;

  // ---------------------------------------------------
  // 3) SI EL USUARIO YA ESTÁ EN FLUJO DE RESERVA → seguir
  // ---------------------------------------------------
  if (session.flowActive) {
    const flowResponse = await tryStartFlow(from, message, session, intent);
    return flowResponse;
  }

  // ---------------------------------------------------
  // 4) NO ESTÁ EN FLUJO → IA responde de forma natural
  // ---------------------------------------------------
  const aiResponse = await conversationalReply(from, message, session, intent);

  // -------------------------------
  // 5) SI LA IA DECIDE QUE DEBE AGENDAR
  // -------------------------------
  if (intent === "start_reservation" || session.suggestStartFlow === true) {
    session.flowActive = true;
    const startMsg =
      "✨ Claro, puedo ayudarte a agendar.\nAntes de continuar… ¿a nombre de quién hago tu reservación?";

    return aiResponse + "\n\n" + startMsg;
  }

  return aiResponse;
}

module.exports = { handleMessage };
