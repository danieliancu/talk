export function normalizeText(str) {
  return (str || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, ""); // elimină spații, simboluri, liniuțe etc.
}
