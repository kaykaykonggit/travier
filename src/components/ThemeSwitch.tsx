import type { CSSProperties } from "react";
import { THEMES, type ThemeId } from "../lib/theme";

export function ThemeSwitch({
  value,
  onChange,
}: {
  value: ThemeId;
  onChange: (theme: ThemeId) => void;
}) {
  return (
    <div className="theme-switch" role="group" aria-label="色調">
      {THEMES.map((option) => (
        <button
          key={option.id}
          type="button"
          className={`theme-swatch${value === option.id ? " on" : ""}`}
          aria-label={option.label}
          aria-pressed={value === option.id}
          title={option.label}
          style={{ "--swatch": option.swatch } as CSSProperties}
          onClick={() => onChange(option.id)}
        />
      ))}
    </div>
  );
}
