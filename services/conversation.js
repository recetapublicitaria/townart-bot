// services/conversation.js
// Procesa la intención del usuario y forma la respuesta de Soni

const { detectIntent, processBookingFlow } = require("./logic");
const { getSession, updateSession } = require("./session");

// Información general fija del Spa y Academia
const infoSpa = `
En nuestro Spa TOWN ART trabajamos con biocosmética de alta calidad y aparatología de grado médico 💆‍♀️✨.
Tratamos tu piel y tu cuerpo como una obra de arte.

Los faciales cuestan entre $1,080 y $1,320 dependiendo del tipo:
• Limpieza profunda — $1,080  
• Hidratante — $1,320  
• Despigmentante — $1,320  
• Lifting — $1,320  
• Nutrición — $1,320  
• Anti acné — $1,320  
• Anti aging — $1,320  

Y para cualquier tratamiento la recomendación ideal es una *valoración* con especialista: dura 30 min y cuesta $200.
`;

const infoPole = `
En la Academia TOWN ART todas las clases son multinivel 🩰💪.

Clases disponibles:
• Pole Fitness  
• Flying Pole  
• Flexibilidad (Flexi)  
• Floorwork  
• Acrobacia  

Paquetes desde $630 al mes; clases sueltas desde $190.
`;

const poleScheduleString = `
🩰 *Horarios de Pole Fitness y Artes Aéreas*

Lunes → 11:00, 18:00, 19:00  
Martes → 10:00, 11:00, 19:00, 20:15  
Miércoles → 11:00, 18:00, 19:00  
Jueves → 10:00, 18:00, 19:00, 20:30  
Viernes → 11:00, 12:30, 18:00, 19:00  
Sábado → 10:00, 11:00, 13:00  
`;


// -------------------------
// RESPUESTA GENERAL (antes de reserva)
// -------------------------
async function generalResponse(from, userMessage) {
  const session = getSession(from);
  const intent = detectIntent(userMessage);

  // Guardar nombre si el usuario lo dice espontáneamente
  if (!session.nombre) {
    const nameMatch = userMessage.match(/soy ([a-zA-Záéíóúñ ]+)/i);
    if (nameMatch) {
      session.nombre = nameMatch[1].trim();
      updateSession(from, session);
    }
  }

  // ---- INTENT: Información
  if (intent === "info") {
    if (userMessage.toLowerCase().includes("spa") || userMessage.toLowerCase().includes("facial")) {
      return {
        reply:
          infoSpa +
          "\n¿Qué servicio te interesa conocer más? También puedo ayudarte a agendar 💜"
      };
    }

    if (userMessage.toLowerCase().includes("pole")) {
      return {
        reply:
          infoPole + "\n\nSi quieres te paso los horarios oficiales 🕒"
      };
    }

    // Info general
    return {
      reply: `
TOWN ART es un Spa + Academia de Pole Fitness 💜.

¿Qué te gustaría saber?
• Precios  
• Horarios  
• Tipos de faciales  
• Tipos de clases  
• Recomendaciones  
• Agendar una cita  
`
    };
  }

  // ---- INTENT: Recomendación
  if (intent === "recommend") {
    if (userMessage.toLowerCase().includes("piel") || userMessage.toLowerCase().includes("manchas") || userMessage.toLowerCase().includes("facial")) {
      return {
        reply: `
Por lo que me dices, lo ideal es una *valoración con especialista* ($200).  
Ahí revisamos tu piel, tus necesidades, tus hábitos y definimos un tratamiento realista 💆‍♀️✨.

¿Quieres que te ayude a agendar tu valoración?
`
      };
    }

    if (userMessage.toLowerCase().includes("cuerpo") || userMessage.toLowerCase().includes("abdomen")) {
      return {
        reply: `
Para temas corporales lo mejor es una valoración también, porque no todos los cuerpos responden igual 💜.

Puedo guiarte, pero una valoración presencial es el inicio perfecto ✨  
¿Quieres que la agendemos?
`
      };
    }

    if (userMessage.toLowerCase().includes("clase")) {
      return {
        reply: `
Para empezar Pole Fitness es la mejor opción 🩰💪  
Es multinivel, así que aunque seas principiante te sentirás súper acompañada.

Si quieres, te paso los horarios o agendamos ya una clase ✨
`
      };
    }

    return {
      reply: "Puedo recomendarte algo, cuéntame un poquito qué buscas lograr 💜"
    };
  }

  // ---- INTENT: Reserva
  if (intent === "booking") {
    return await processBookingFlow(from, userMessage);
  }

  // ---- FALLBACK
  return {
    reply:
      "¿En qué te puedo apoyar hoy? 💜\nPuedo darte información de tratamientos, clases o ayudarte a agendar."
  };
}

module.exports = {
  generalResponse
};
