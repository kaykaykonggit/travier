export function cleanSourceUrl(value: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  const markdown = trimmed.match(/^\[([^\]]+)\]\((https?:\/\/[^)]+)\)$/);
  if (markdown) return markdown[2];
  const wrapped = trimmed.match(/^\[(https?:\/\/[^\]]+)\]$/);
  if (wrapped) return wrapped[1];
  return trimmed || null;
}

export function sanitizeTripJson(raw: string): string {
  let text = raw.trim();
  text = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  text = text.replace(/\[(https?:\/\/[^\]]+)\]\(\1\)/g, "$1");
  text = text.replace(/\[(https?:\/\/[^\]]+)\]\((https?:\/\/[^)]+)\)/g, "$2");
  text = text.replace(/\b(true|false)\s*,\s*all\b/g, "$1,");
  text = text.replace(/,(\s*[}\]])/g, "$1");
  return text;
}
