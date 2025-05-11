// lib/search.js

const keywordSynonyms = {
  smsts: "Site Management Safety Training Scheme",
  sssts: "Site Supervisors Safety Training Scheme",
  twc: "Temporary Works Coordinator",
  tws: "Temporary Works Supervisor",
  hsa: "Health and Safety Awareness",
  "nebosh-general": "NEBOSH National General Certificate in Occupational Health and Safety",
  "nebosh-construction": "NEBOSH Health & Safety Management for Construction Certificate"
};


// 🧠 Permite identificarea chiar dacă utilizatorul scrie numele complet
const synonymLookup = {};
Object.entries(keywordSynonyms).forEach(([abbr, full]) => {
  const normFull = full.toLowerCase().trim();
  synonymLookup[abbr.toLowerCase()] = abbr;
  synonymLookup[normFull] = abbr;

  // expresii adăugate manual
  if (abbr === "nebosh-general") {
    synonymLookup["nebosh general"] = abbr;
    synonymLookup["neboshgeneral"] = abbr;
  }
  if (abbr === "nebosh-construction") {
    synonymLookup["nebosh construction"] = abbr;
    synonymLookup["neboshconstruction"] = abbr;
  }
});


function extractLocation(name) {
  const parts = name.split("|");
  return parts.length >= 2 ? parts[1].trim() : "Unknown";
}

function parseDate(dateStr) {
  if (!dateStr || typeof dateStr !== "string") return null;

  // 🧠 Dacă există un interval (ex: "5 May - 9 May"), ia ultima parte
  if (dateStr.includes("-")) {
    const parts = dateStr.split("-");
    dateStr = parts[1].trim(); // ia finalul
  }

  // 🧠 Dacă există `\n` sau multiple linii, ia PRIMA data din prima linie
  if (dateStr.includes("\n")) {
    dateStr = dateStr.split("\n")[0].trim();
  }

  const parsed = new Date(dateStr);
  return isNaN(parsed) ? null : parsed;
}


function searchCourses(allProducts, keyword = '', month = null, require_available_spaces = false, location = null, typeFilter = null) {
  const keywordInput = keyword.toLowerCase().trim();
  const keywordKey = synonymLookup[keywordInput];
  if (!keywordKey) return [];

  const resolvedKeyword = keywordSynonyms[keywordKey].toLowerCase();
  const monthLower = month?.toLowerCase().trim() || null;
  const locationLower = location?.toLowerCase().trim() || null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return allProducts.filter(product => {
    const name = product.name?.toLowerCase() || '';
    const type = name.includes("refresher") ? "refresher" : "standard";

const matchesKeyword =
  name.includes(resolvedKeyword.toLowerCase()) ||
  name.includes(keywordKey?.toLowerCase()) ||
  name.includes(keywordInput) ||
  (
    keywordKey === "nebosh-general" && name.includes("nebosh") && name.includes("general")
  ) ||
  (
    keywordKey === "nebosh-construction" && name.includes("nebosh") && name.includes("construction")
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
// Exclude cursuri care au început deja sau s-au terminat
if (
  (startDateObj && startDateObj < todayTime && (!endDateObj || endDateObj < todayTime)) ||
  (endDateObj && endDateObj < todayTime)
) {
  return false;
}




    product._meta = {
      price: parseFloat(product.price),
      available_spaces: parseInt(product.available_spaces),
      start: startDateObj,
      end: endDateObj,
      isUpcoming: startDateObj && startDateObj > todayTime,
      isOngoing: startDateObj && endDateObj && todayTime >= startDateObj && todayTime <= endDateObj,
      duration_days: startDateObj && endDateObj
        ? Math.round((endDateObj - startDateObj) / (1000 * 60 * 60 * 24)) + 1
        : null,
      type,
      location: extractLocation(product.name)
    };

    return true;
  });
}

export {
  searchCourses,
  extractLocation,
  parseDate,
  synonymLookup,
  keywordSynonyms
};
