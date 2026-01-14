const { normalize } = require("./normalize");

const intents = {
  reservation: [
    "agendar",
    "cita",
    "reservar",
    "reserva",
    "quiero una clase",
    "quiero asistir",
    "agenda",
    "quiero ir",
    "quiero tomar",
  ],
  info: [
    "precio",
    "cuanto cuesta",
    "informacion",
    "costos",
    "que incluye",
    "horario",
    "horarios",
    "donde estan",
    "ubicacion",
    "direccion",
  ],
  recommend: [
    "que recomiendas",
    "que me recomiendas",
    "que me sirve",
    "que me aconsejas",
    "que me sugeririas",
  ],
  pole: ["pole", "clase", "flying", "flexi", "floorwork", "acrobacia"],
  skin: ["acne", "manchas", "pigmentacion", "piel"],
};

function detectIntentAdvanced(text) {
  const t = normalize(text);

  for (const intent in intents) {
    if (intents[intent].some((w) => t.includes(w))) {
      return intent;
    }
  }

  return "general";
}

module.exports = { detectIntentAdvanced };
