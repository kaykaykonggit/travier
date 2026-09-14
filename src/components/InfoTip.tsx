import { useEffect, useId, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

type InfoTipProps = {
  label?: string;
  title: string;
  children: ReactNode;
};

/** Compact "i" control: tap/hold opens that field's real how-to, never a meta "long-press" hint. */
export function InfoTip({ label = "教學", title, children }: InfoTipProps) {
  const tipId = useId();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  function block(event: { preventDefault(): void; stopPropagation(): void }) {
    event.preventDefault();
    event.stopPropagation();
  }

  function openTip(event: { preventDefault(): void; stopPropagation(): void }) {
    block(event);
    setOpen(true);
  }

  return (
    <span
      className="info-tip"
      onClick={block}
      onMouseDown={block}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        className="info-tip-btn"
        aria-label={`${label}：${title}`}
        aria-expanded={open}
        aria-controls={open ? `${tipId}-panel` : undefined}
        onClick={openTip}
        onContextMenu={(event) => event.preventDefault()}
      >
        i
      </button>
      {open &&
        createPortal(
          <div className="info-tip-layer" role="presentation" onClick={() => setOpen(false)}>
            <div
              id={`${tipId}-panel`}
              className="info-tip-panel"
              role="dialog"
              aria-modal="true"
              aria-labelledby={`${tipId}-title`}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="info-tip-head">
                <h2 id={`${tipId}-title`}>{title}</h2>
                <button type="button" className="text-btn" onClick={() => setOpen(false)}>
                  關閉
                </button>
              </div>
              <div className="info-tip-body">{children}</div>
            </div>
          </div>,
          document.body,
        )}
    </span>
  );
}
