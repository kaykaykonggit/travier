import { useEffect, useRef, useState } from "react";
import { DURATION_OPTIONS, formatDurationLabel, nearestDurationOption } from "../lib/timelineTime";

export function DurationWheel({
  valueMin,
  onConfirm,
  onClose,
}: {
  valueMin: number;
  onConfirm: (minutes: number) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(() => nearestDurationOption(valueMin));
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const root = listRef.current;
    if (!root) return;
    const active = root.querySelector<HTMLElement>("[data-active='true']");
    active?.scrollIntoView({ block: "center", behavior: "instant" in window ? "instant" : "auto" });
  }, []);

  return (
    <div className="duration-wheel" role="dialog" aria-label="調整活動時長">
      <div className="duration-wheel-head">
        <strong>活動時長</strong>
        <button type="button" className="text-btn" onClick={onClose}>
          關閉
        </button>
      </div>
      <div className="duration-wheel-frame">
        <div className="duration-wheel-fade duration-wheel-fade-top" aria-hidden="true" />
        <div className="duration-wheel-list" ref={listRef}>
          {DURATION_OPTIONS.map((option) => (
            <button
              key={option}
              type="button"
              data-active={option === draft ? "true" : "false"}
              className={`duration-wheel-option${option === draft ? " on" : ""}`}
              onClick={() => setDraft(option)}
            >
              {formatDurationLabel(option)}
            </button>
          ))}
        </div>
        <div className="duration-wheel-fade duration-wheel-fade-bottom" aria-hidden="true" />
      </div>
      <button type="button" className="btn btn-primary duration-wheel-confirm" onClick={() => onConfirm(draft)}>
        確認調整為 {formatDurationLabel(draft)}
      </button>
    </div>
  );
}
