import type { ReactNode } from "react";
import type { LifeCategory } from "../lib/life";

type GlyphId = LifeCategory | "all" | "day";

function IconFrame({ children, title }: { children: ReactNode; title: string }) {
  return (
    <svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" aria-hidden="true">
      <title>{title}</title>
      {children}
    </svg>
  );
}

const stroke = {
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function LifeGlyph({ id }: { id: GlyphId }) {
  if (id === "yi") {
    return (
      <IconFrame title="衣">
        <path d="M8.2 4.8 12 7.2l3.8-2.4 3.2 3.2-3.4 2V19.2H8.4V10l-3.4-2 3.2-3.2Z" {...stroke} />
        <path d="M8.4 10.2h7.2" {...stroke} />
      </IconFrame>
    );
  }
  if (id === "shi") {
    return (
      <IconFrame title="食">
        <path d="M5 13.2c1.2 4.2 12.8 4.2 14 0" {...stroke} />
        <path d="M5.2 13.2h13.6" {...stroke} />
        <path d="M9.2 5.2v5.4M12 4.8v5.8M14.8 5.2v5.4" {...stroke} />
      </IconFrame>
    );
  }
  if (id === "zhu") {
    return (
      <IconFrame title="住">
        <path d="M4.6 11.6 12 5.2l7.4 6.4V19H4.6v-7.4Z" {...stroke} />
        <path d="M10.2 19v-5.2h3.6V19" {...stroke} />
      </IconFrame>
    );
  }
  if (id === "xing") {
    return (
      <IconFrame title="行">
        <path d="M4.4 15.2h15.2" {...stroke} />
        <path d="M6.2 15.2 8.6 9.4h4.2l3.8 3.4h2.6" {...stroke} />
        <circle cx="8.2" cy="17.2" r="1.3" {...stroke} />
        <circle cx="16.4" cy="17.2" r="1.3" {...stroke} />
      </IconFrame>
    );
  }
  if (id === "wan") {
    return (
      <IconFrame title="玩">
        <rect x="4.6" y="7.2" width="14.8" height="10.4" rx="1.6" {...stroke} />
        <path d="M8.4 7.2V5.8M15.6 7.2V5.8M4.6 11.4h14.8" {...stroke} />
      </IconFrame>
    );
  }
  if (id === "day") {
    return (
      <IconFrame title="行程">
        <rect x="5" y="6.2" width="14" height="13" rx="1.8" {...stroke} />
        <path d="M8 4.8v2.8M16 4.8v2.8M5 10.2h14" {...stroke} />
        <path d="M8.4 13.4h3.2M8.4 16.2h7.2" {...stroke} />
      </IconFrame>
    );
  }
  return (
    <IconFrame title="全部">
      <circle cx="8" cy="8" r="1.35" fill="currentColor" />
      <circle cx="16" cy="8" r="1.35" fill="currentColor" />
      <circle cx="8" cy="16" r="1.35" fill="currentColor" />
      <circle cx="16" cy="16" r="1.35" fill="currentColor" />
    </IconFrame>
  );
}

export function PrepGlyph() {
  return (
    <IconFrame title="預備">
      <rect x="5.2" y="4.6" width="13.6" height="15.2" rx="1.8" {...stroke} />
      <path d="M8.2 9.2h7.6M8.2 12.4h7.6M8.2 15.6h5.2" {...stroke} />
      <path d="M8.4 6.6l1.1 1.1 2.2-2.4" {...stroke} />
    </IconFrame>
  );
}

export function LifeQuadMark({ active = false }: { active?: boolean }) {
  return (
    <span className={`life-quad${active ? " on" : ""}`} aria-hidden="true">
      <LifeGlyph id="yi" />
      <LifeGlyph id="shi" />
      <LifeGlyph id="zhu" />
      <LifeGlyph id="xing" />
    </span>
  );
}

export function TripTabs({
  tab,
  onChange,
}: {
  tab: "prep" | "trip" | "life";
  onChange: (tab: "prep" | "trip" | "life") => void;
}) {
  return (
    <nav className="trip-tabs" aria-label="主分頁">
      <p className="tabs-brand">Travier</p>
      <button type="button" className={tab === "prep" ? "on" : ""} onClick={() => onChange("prep")}>
        <span className="tab-icon" aria-hidden="true">
          <PrepGlyph />
        </span>
        預備
      </button>
      <button type="button" className={tab === "trip" ? "on" : ""} onClick={() => onChange("trip")}>
        <span className="tab-icon" aria-hidden="true">
          <LifeGlyph id="day" />
        </span>
        行程
      </button>
      <button type="button" className={tab === "life" ? "on" : ""} onClick={() => onChange("life")}>
        <LifeQuadMark active={tab === "life"} />
        衣食住行
      </button>
    </nav>
  );
}
