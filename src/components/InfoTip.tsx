import { useEffect, useId, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";

const HOLD_MS = 420;

type InfoTipProps = {
  label?: string;
  title: string;
  children: ReactNode;
};

export function InfoTip({ label = "教學", title, children }: InfoTipProps) {
  const tipId = useId();
  const [open, setOpen] = useState(false);
  const [hint, setHint] = useState(false);
  const timer = useRef<number | null>(null);
  const held = useRef(false);

  function clearTimer() {
    if (timer.current != null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  }

  function startHold(event: ReactPointerEvent<HTMLButtonElement>) {
    held.current = false;
    clearTimer();
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      /* ignore */
    }
    timer.current = window.setTimeout(() => {
      held.current = true;
      setHint(false);
      setOpen(true);
    }, HOLD_MS);
  }

  function endHold() {
    clearTimer();
    if (!held.current) {
      setHint(true);
      window.setTimeout(() => setHint(false), 1600);
    }
  }

  useEffect(() => () => clearTimer(), []);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <span className="info-tip">
      <button
        type="button"
        className="info-tip-btn"
        aria-label={`${label}：長按睇詳細`}
        aria-describedby={hint ? `${tipId}-hint` : undefined}
        aria-expanded={open}
        aria-controls={open ? `${tipId}-panel` : undefined}
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          event.preventDefault();
          event.stopPropagation();
          startHold(event);
        }}
        onPointerUp={(event) => {
          event.preventDefault();
          event.stopPropagation();
          endHold();
        }}
        onPointerCancel={endHold}
        onLostPointerCapture={clearTimer}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
        }}
        onContextMenu={(event) => event.preventDefault()}
      >
        i
      </button>
      {hint && (
        <span id={`${tipId}-hint`} className="info-tip-hint" role="status">
          長按 i 睇教學
        </span>
      )}
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
