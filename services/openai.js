const OpenAI = require("openai");
const knowledge = require("./knowledge");

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const MODEL = process.env.OPENAI_MODEL || "gpt-4.1-mini";

function clamp(text, max = 650) {
  const t = String(text || "").trim();
  if (!t) return "";
  return t.length <= max ? t : t.slice(0, max - 1).trim() + "…";
}

function fallbackReply(session) {
  const name = session?.name ? `, ${session.name}` : "";
  return (
    `Hola${name} 😊 Soy *Tania* de Town Art 💜\n` +
    `¿Qué te interesa hoy: *Spa* o *clases*?\n\n` +
    `📍 ${knowledge.brand.address}\n` +
    `🕒 ${knowledge.hours.general}\n` +
    `WhatsApp: ${knowledge.brand.whatsapp}`
  );
}

// Heurística barata para detectar reserva SIN IA
function fastIntent(text = "") {
  const t = text.toLowerCase();
  const keys = ["agendar", "cita", "reservar", "reserva", "apart", "agenda", "quiero una cita", "quiero agendar", "quiero reservar"];
  if (keys.some(k => t.includes(k))) return "reservar";
  return "chat";
}

/**
 * analyzeMessage(text, options)
 * - Si options.mode === "chat": devuelve texto para WhatsApp
 * - Si options.mode === "intent": devuelve "reservar" o "chat"
 * - Si no mandas mode: por default devuelve "chat"
 */
async function analyzeMessage(text, options = {}, session = null) {
  const mode = options.mode || "chat";

  // INTENT: rápido y sin tokens
  if (mode === "intent") return fastIntent(text);

  // CHAT
  try {
    if (!process.env.OPENAI_API_KEY) {
      console.error("❌ Falta OPENAI_API_KEY");
      return fallbackReply(session);
    }

    const sys = `
Eres TANIA de Town Art Pole & Spa (Ecatepec). SIEMPRE te presentas como "Tania" (no digas asistente virtual).
Tono: cálido, humano, vendedora y honesta. Respuestas cortas (máx 6–8 líneas).
Reglas:
- Si preguntan por tratamientos (acné, manchas, etc.): recomienda iniciar con valoración $${knowledge.spa.valuation.price} (30 min).
- Para clases: recuerda que hay horarios fijos y debes mostrar horarios.
- No digas "OK" jamás.
`.trim();

    const completion = await openai.chat.completions.create({
      model: MODEL,
      temperature: 0.5,
      max_tokens: 220,
      messages: [
        { role: "system", content: sys },
        { role: "user", content: text },
      ],
    });

    const out = completion.choices?.[0]?.message?.content || "";
    return clamp(out) || fallbackReply(session);
  } catch (err) {
    console.error("❌ OpenAI error:", err?.message || err);
    return fallbackReply(session);
  }
}

module.exports = {
  analyzeMessage, // ✅ para que tu server.js no truene
};
