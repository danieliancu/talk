import { normalizeText } from "./utils/normalize";

const sortTriggers = {
  cheapest: ["cheapest", "lowest price", "low cost", "least expensive"],
  expensive: ["most expensive", "highest price", "premium", "expensive course"],
  soonest: ["soonest", "earliest", "first available", "next one"],
  latest: ["latest", "last one", "latest date"],
  shortest: ["shortest", "least days", "minimum duration"],
  longest: ["longest", "maximum duration", "many days"],
  "most spaces": ["most spaces", "more availability", "more seats"],
  "least spaces": ["least spaces", "almost full", "low availability"]
};

function detectSortKey(message) {
  const normalized = normalizeText(message);
  for (const [key, phrases] of Object.entries(sortTriggers)) {
    if (phrases.some(p => normalized.includes(p))) return key;
  }
  return null;
}

export { sortTriggers, detectSortKey };
