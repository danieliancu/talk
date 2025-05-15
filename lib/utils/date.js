// lib/utils/date.js

function parseDate(dateStr) {
  if (!dateStr || typeof dateStr !== "string") return null;

  if (dateStr.includes("-")) {
    const parts = dateStr.split("-");
    dateStr = parts[1].trim();
  }

  if (dateStr.includes("\n")) {
    dateStr = dateStr.split("\n")[0].trim();
  }

  const parsed = new Date(dateStr);
  return isNaN(parsed) ? null : parsed;
}

export { parseDate };
