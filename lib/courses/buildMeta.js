// lib/courses/buildMeta.js

import { parseDate } from "../utils/date";
import { extractLocation } from "../utils/location";

function buildMeta(product, today) {
  const startDateObj = parseDate(product.start_date);
  const endDateObj = parseDate(product.end_date);
  const todayTime = today.getTime();

  return {
    price: parseFloat(product.price),
    available_spaces: parseInt(product.available_spaces),
    start: startDateObj,
    end: endDateObj,
    isUpcoming: startDateObj && startDateObj > todayTime,
    isOngoing: startDateObj && endDateObj && todayTime >= startDateObj && todayTime <= endDateObj,
    duration_days: startDateObj && endDateObj
      ? Math.round((endDateObj - startDateObj) / (1000 * 60 * 60 * 24)) + 1
      : null,
    type: product.name?.toLowerCase().includes("refresher") ? "refresher" : "standard",
    location: extractLocation(product.name)
  };
}

export { buildMeta };
