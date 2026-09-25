/**
 * Format a raw name or email prefix into a display-friendly name.
 * - If the name looks clean (no trailing digits, length > 2), use it as-is.
 * - Otherwise, strip trailing digits and try to split camelCase.
 */
export function formatDisplayName(raw: string | null | undefined): string {
  if (!raw || raw === "Administrator") return "User";

  let cleaned = raw.trim();

  // Strip trailing digits (e.g. "developer1234" → "developer")
  cleaned = cleaned.replace(/\d+$/, "");

  if (cleaned.length < 2) return raw; // too short after stripping, return original

  // Try to split camelCase: "anilpradhan" → "anil pradhan", "johnDoe" → "john Doe"
  // Insert space before uppercase letters
  const split = cleaned.replace(/([a-z])([A-Z])/g, "$1 $2");

  // Capitalize each word
  const formatted = split
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");

  return formatted || raw;
}
