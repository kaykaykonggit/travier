import { useEffect, useId, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";

const HOLD_MS = 320;

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
  const hintTimer = useRef<number | null>(null);

  function clearHoldTimer() {
    if (timer.current != null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  }

  function clearHintTimer() {
    if (hintTimer.current != null) {
      window.clearTimeout(hintTimer.current);
      hintTimer.current = null;
    }
  }

  function startHold(event: ReactPointerEvent<HTMLButtonElement>) {
    held.current = false;
    clearHoldTimer();
    clearHintTimer();
    setHint(false);
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      /* ignore */
    }
    timer.current = window.setTimeout(() => {
      held.current = true;
      timer.current = null;
      setHint(false);
      setOpen(true);
    }, HOLD_MS);
  }

  function endHold() {
    const wasHolding = timer.current != null;
    clearHoldTimer();
    if (!held.current && wasHolding) {
      setHint(true);
      clearHintTimer();
      hintTimer.current = window.setTimeout(() => setHint(false), 1600);
    }
  }

  useEffect(
    () => () => {
      clearHoldTimer();
      clearHintTimer();
    },
    [],
  );

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
        aria-label={`${label}：長按睇詳細`}
        aria-describedby={hint ? `${tipId}-hint` : undefined}
        aria-expanded={open}
        aria-controls={open ? `${tipId}-panel` : undefined}
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          block(event);
          startHold(event);
        }}
        onPointerUp={(event) => {
          block(event);
          endHold();
        }}
        onPointerCancel={endHold}
        onLostPointerCapture={() => {
          if (timer.current != null) endHold();
        }}
        onClick={block}
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
