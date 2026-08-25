/**
 * Clinical notes presentation helpers — never surface raw JSON to users.
 */

export function looksLikeRawJson(value: string): boolean {
  const t = value.trim();
  if (!(t.startsWith("{") || t.startsWith("["))) return false;
  try {
    JSON.parse(t);
    return true;
  } catch {
    return false;
  }
}

/** Return human-readable notes, or null when the value is serialized JSON. */
export function humanReadableClinicalNotes(
  raw: string | null | undefined,
): string | null {
  if (!raw?.trim()) return null;
  if (looksLikeRawJson(raw)) return null;
  return raw.trim();
}
