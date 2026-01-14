// js/theme.js
export const theme = Object.freeze({
  pressure: "#fbbf24",     // Amber / Sand
  shock: "#fb7185",        // Muted Rose
  route: "#92400e",        // Dusty Brown
  destination: "#64748b",  // Desaturated Blue-Gray
  context: "#9ca3af",      // Warm Gray

  // UI text colors (NOT for "meaningful data marks")
  text: "#e5e7eb",
  mutedText: "#9ca3af",
});

export const ALLOWED_MARK_KEYS = Object.freeze([
  "pressure",
  "shock",
  "route",
  "destination",
  "context",
]);

export function markColor(key) {
  if (!ALLOWED_MARK_KEYS.includes(key)) {
    throw new Error(`Invalid mark color key "${key}". Allowed: ${ALLOWED_MARK_KEYS.join(", ")}`);
  }
  return theme[key];
}
