const OpenAI = require("openai");
const knowledge = require("./knowledge");

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const MODEL = process.env.OPENAI_MODEL || "gpt-4.1-mini";

function clampReply(text) {
  // evita respuestas eternas
  const t = String(text || "").trim();
  if (t.length <= 700) return t;
  return t.slice(0, 680).trim() + "…";
}

// Respuesta general (fuera de reserva)
async function chatReply(userText, session) {
  const sys = `
Eres TANIA de Town Art Pole & Spa (Ecatepec). SIEMPRE te presentas como "Tania" (no digas asistente virtual).
Tono: cálido, humano, breve, vendedor pero honesto.
Reglas:
- Respuestas máximo 6–8 líneas.
- Cuando sea tema de piel/acné/manchas o tratamiento, sugiere "valoración con especialista" $${knowledge.spa.valuation.price} (30 min).
- Para clases: aclara que hay horarios fijos y puedes compartir horarios.
- Si preguntan ubicación/horarios/redes/teléfonos: responde exacto.
Datos:
Dirección: ${knowledge.brand.address}
WhatsApp: ${knowledge.brand.whatsapp}
Horario general: ${knowledge.hours.general}
Horario recomendado Spa: ${knowledge.hours.spaRecommended}
`.trim();

  const nameLine = session?.name ? `El usuario se llama: ${session.name}` : "";
  const lastArea = session?.lastAreaHint ? `Venían hablando de: ${session.lastAreaHint}` : "";

  const completion = await openai.chat.completions.create({
    model: MODEL,
    temperature: 0.5,
    max_tokens: 220,
    messages: [
      { role: "system", content: sys },
      { role: "user", content: `${nameLine}\n${lastArea}\nMensaje: ${userText}`.trim() }
    ]
  });

  return clampReply(completion.choices?.[0]?.message?.content || "");
}

module.exports = { chatReply };
