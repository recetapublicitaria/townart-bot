function stripAccents(s = "") {
  return String(s)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

module.exports = { stripAccents };
