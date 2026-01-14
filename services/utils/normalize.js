function normalize(text) {
  if (!text) return "";

  return text
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // quitar acentos
    .toLowerCase()
    .trim();
}

module.exports = { normalize };
