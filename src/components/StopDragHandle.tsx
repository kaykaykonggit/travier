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
  const fromRef = useRef(index);
  const lastTo = useRef(index);

  function rowIndexFromPoint(clientY: number): number | null {
    const rows = document.querySelectorAll<HTMLElement>("[data-stop-index]");
    for (const row of rows) {
      const rect = row.getBoundingClientRect();
      if (clientY >= rect.top && clientY <= rect.bottom) {
        const value = Number(row.dataset.stopIndex);
        return Number.isFinite(value) ? value : null;
      }
    }
    return null;
  }

  function onPointerDown(event: React.PointerEvent<HTMLButtonElement>) {
    if (disabled) return;
    event.preventDefault();
    event.stopPropagation();
    fromRef.current = index;
    lastTo.current = index;
    setDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: React.PointerEvent<HTMLButtonElement>) {
    if (!dragging) return;
    const target = rowIndexFromPoint(event.clientY);
    if (target == null || target === lastTo.current) return;
    lastTo.current = target;
    document.querySelectorAll("[data-stop-index]").forEach((node) => {
      node.classList.toggle("is-drop-target", Number((node as HTMLElement).dataset.stopIndex) === target);
    });
  }

  function finish(event: React.PointerEvent<HTMLButtonElement>) {
    if (!dragging) return;
    setDragging(false);
    document.querySelectorAll("[data-stop-index]").forEach((node) => node.classList.remove("is-drop-target"));
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
      <span aria-hidden="true">⋮⋮</span>
    </button>
  );
}
