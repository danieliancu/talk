// lib/search.js

import { keywordSynonyms, synonymLookup } from "./synonyms";
import { parseDate } from "./utils/date";
import { buildMeta } from "./courses/buildMeta";
import { normalizeText } from "./utils/normalize";

function searchCourses(
  allProducts,
  keyword = '',
  month = null,
  require_available_spaces = false,
  location = null,
  typeFilter = null
) {
  const keywordInput = normalizeText(keyword);
  const keywordKey = synonymLookup[keywordInput];
  if (!keywordKey) return [];

  const resolvedKeyword = normalizeText(keywordSynonyms[keywordKey]);
  const monthLower = month?.toLowerCase().trim() || null;
  const locationLower = normalizeText(location || '');
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return allProducts.filter(product => {
    const nameRaw = product.name || '';
    const name = normalizeText(nameRaw);
    const type = name.includes("refresher") ? "refresher" : "standard";

    const matchesKeyword =
      name.includes(resolvedKeyword) ||
      name.includes(keywordKey) ||
      name.includes(keywordInput) ||
      (
        keywordKey === "nebosh-general" &&
        name.includes("nebosh") &&
        name.includes("general")
      ) ||
      (
        keywordKey === "nebosh-construction" &&
        name.includes("nebosh") &&
        name.includes("construction")
      );

    if (!matchesKeyword) return false;
    if (typeFilter && type !== typeFilter) return false;

    if (require_available_spaces && (!product.available_spaces || parseInt(product.available_spaces) <= 0)) {
      return false;
    }

    if (monthLower && product.start_date) {
      const match = product.start_date.match(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\b/i);
      if (!match || match[1].toLowerCase() !== monthLower) return false;
    }

    if (locationLower && !name.includes(locationLower)) return false;

    const startDateObj = parseDate(product.start_date);
    const endDateObj = parseDate(product.end_date);
    const todayTime = today.getTime();

    if (
      (startDateObj && startDateObj < todayTime && (!endDateObj || endDateObj < todayTime)) ||
      (endDateObj && endDateObj < todayTime)
    ) {
      return false;
    }

    product._meta = buildMeta(product, today);
    return true;
  });
}

export {
  searchCourses,
  parseDate,
  synonymLookup,
  keywordSynonyms
};
