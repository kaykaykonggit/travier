export type ThemeId = "moss" | "mist" | "sand";

const THEME_KEY = "travier.theme.v1";

export const THEMES: Array<{ id: ThemeId; label: string; swatch: string }> = [
  { id: "moss", label: "苔綠", swatch: "#16351c" },
  { id: "mist", label: "霧藍", swatch: "#355468" },
  { id: "sand", label: "暖石", swatch: "#3f4a36" },
];

export function loadTheme(): ThemeId {
  try {
    const raw = localStorage.getItem(THEME_KEY);
    if (raw === "mist" || raw === "sand" || raw === "moss") return raw;
  } catch {
    /* ignore */
  }
  return "moss";
}

export function saveTheme(theme: ThemeId): void {
  localStorage.setItem(THEME_KEY, theme);
}

export function applyTheme(theme: ThemeId): void {
  document.documentElement.dataset.theme = theme;
}
