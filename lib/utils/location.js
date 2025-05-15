// lib/utils/location.js

export function extractLocation(name) {
  const parts = name.split("|");
  return parts.length >= 2 ? parts[1].trim() : "Unknown";
}
