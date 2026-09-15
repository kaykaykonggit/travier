import { useRef, useState } from "react";

/** Hold-and-drag handle that reports target index while moving over stop rows. */
export function StopDragHandle({
  index,
  disabled,
  onReorder,
}: {
  index: number;
  disabled?: boolean;
  onReorder: (from: number, to: number) => void;
}) {
  const [dragging, setDragging] = useState(false);
  const draggingRef = useRef(false);
  const fromRef = useRef(index);
  const lastTo = useRef(index);

  function rowIndexFromPoint(clientY: number): number | null {
    const rows = document.querySelectorAll<HTMLElement>("[data-stop-index]");
    let best: { index: number; dist: number } | null = null;
    for (const row of rows) {
      const rect = row.getBoundingClientRect();
      const mid = (rect.top + rect.bottom) / 2;
      const dist = Math.abs(clientY - mid);
      const value = Number(row.dataset.stopIndex);
      if (!Number.isFinite(value)) continue;
      if (clientY >= rect.top - 8 && clientY <= rect.bottom + 8) {
        if (!best || dist < best.dist) best = { index: value, dist };
      }
    }
    return best?.index ?? null;
  }

  function clearTargets() {
    document.querySelectorAll("[data-stop-index]").forEach((node) => node.classList.remove("is-drop-target"));
  }

  function onPointerDown(event: React.PointerEvent<HTMLButtonElement>) {
    if (disabled) return;
    event.preventDefault();
    event.stopPropagation();
    fromRef.current = index;
    lastTo.current = index;
    draggingRef.current = true;
    setDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: React.PointerEvent<HTMLButtonElement>) {
    if (!draggingRef.current) return;
    const target = rowIndexFromPoint(event.clientY);
    if (target == null || target === lastTo.current) return;
    lastTo.current = target;
    document.querySelectorAll("[data-stop-index]").forEach((node) => {
      node.classList.toggle("is-drop-target", Number((node as HTMLElement).dataset.stopIndex) === target);
    });
  }

  function finish(event: React.PointerEvent<HTMLButtonElement>) {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    setDragging(false);
    clearTargets();
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      /* already released */
    }
    const to = lastTo.current;
    if (to !== fromRef.current) onReorder(fromRef.current, to);
  }

  return (
    <button
      type="button"
      className={`stop-drag-handle${dragging ? " is-dragging" : ""}`}
      aria-label="按住拖曳以調整順序"
      title="按住拖曳"
      disabled={disabled}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={finish}
      onPointerCancel={finish}
    >
      <span className="stop-drag-glyph" aria-hidden="true">
        <i />
        <i />
        <i />
        <i />
        <i />
        <i />
      </span>
    </button>
  );
}
