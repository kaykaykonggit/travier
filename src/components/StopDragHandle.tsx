import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type DragGhost = {
  x: number;
  y: number;
  width: number;
  height: number;
  html: string;
};

/** Hold-and-drag handle: floating ghost card + drop target while reordering. */
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
  const [ghost, setGhost] = useState<DragGhost | null>(null);
  const draggingRef = useRef(false);
  const fromRef = useRef(index);
  const lastTo = useRef(index);
  const pointerIdRef = useRef<number | null>(null);
  const offsetRef = useRef({ x: 0, y: 0 });
  const sourceLiRef = useRef<HTMLElement | null>(null);
  const onReorderRef = useRef(onReorder);
  onReorderRef.current = onReorder;

  function stopNodes(): HTMLElement[] {
    return Array.from(document.querySelectorAll<HTMLElement>(".timeline-stop[data-stop-index]"));
  }

  function rowIndexFromPoint(clientY: number): number | null {
    const rows = stopNodes();
    let best: { index: number; dist: number } | null = null;
    for (const row of rows) {
      const rect = row.getBoundingClientRect();
      const mid = (rect.top + rect.bottom) / 2;
      const dist = Math.abs(clientY - mid);
      const value = Number(row.dataset.stopIndex);
      if (!Number.isFinite(value)) continue;
      if (clientY >= rect.top - 12 && clientY <= rect.bottom + 12) {
        if (!best || dist < best.dist) best = { index: value, dist };
      }
    }
    if (best) return best.index;
    if (!rows.length) return null;
    const first = rows[0].getBoundingClientRect();
    const last = rows[rows.length - 1].getBoundingClientRect();
    if (clientY < first.top) return Number(rows[0].dataset.stopIndex);
    if (clientY > last.bottom) return Number(rows[rows.length - 1].dataset.stopIndex);
    return null;
  }

  function clearTargets() {
    stopNodes().forEach((node) => node.classList.remove("is-drop-target"));
  }

  function markTarget(target: number) {
    stopNodes().forEach((node) => {
      node.classList.toggle("is-drop-target", Number(node.dataset.stopIndex) === target);
    });
  }

  function cleanupDragClasses() {
    clearTargets();
    document.body.classList.remove("is-reordering-stops");
    sourceLiRef.current?.classList.remove("is-drag-source");
    sourceLiRef.current = null;
  }

  useEffect(() => {
    function onMove(event: PointerEvent) {
      if (!draggingRef.current) return;
      if (pointerIdRef.current != null && event.pointerId !== pointerIdRef.current) return;
      event.preventDefault();
      const target = rowIndexFromPoint(event.clientY);
      if (target != null && target !== lastTo.current) {
        lastTo.current = target;
        markTarget(target);
      }
      setGhost((current) =>
        current
          ? {
              ...current,
              x: event.clientX - offsetRef.current.x,
              y: event.clientY - offsetRef.current.y,
            }
          : current,
      );
    }

    function onUp(event: PointerEvent) {
      if (!draggingRef.current) return;
      if (pointerIdRef.current != null && event.pointerId !== pointerIdRef.current) return;
      draggingRef.current = false;
      pointerIdRef.current = null;
      setDragging(false);
      setGhost(null);
      cleanupDragClasses();
      const to = lastTo.current;
      if (to !== fromRef.current) onReorderRef.current(fromRef.current, to);
    }

    window.addEventListener("pointermove", onMove, { passive: false });
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, []);

  function onPointerDown(event: React.PointerEvent<HTMLButtonElement>) {
    if (disabled || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();

    const li = event.currentTarget.closest<HTMLElement>(".timeline-stop[data-stop-index]");
    const row = li?.querySelector<HTMLElement>(".stop-compact-row") ?? li;
    if (!li || !row) return;

    const rect = row.getBoundingClientRect();
    fromRef.current = index;
    lastTo.current = index;
    draggingRef.current = true;
    pointerIdRef.current = event.pointerId;
    offsetRef.current = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
    sourceLiRef.current = li;
    li.classList.add("is-drag-source");
    document.body.classList.add("is-reordering-stops");
    setDragging(true);
    setGhost({
      x: rect.left,
      y: rect.top,
      width: rect.width,
      height: rect.height,
      html: row.innerHTML,
    });
    markTarget(index);

    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      /* capture optional; window listeners still drive the drag */
    }
  }

  return (
    <>
      <button
        type="button"
        className={`stop-drag-handle${dragging ? " is-dragging" : ""}`}
        aria-label="按住拖曳以調整順序"
        title="按住拖曳"
        disabled={disabled}
        onPointerDown={onPointerDown}
        onClick={(event) => event.stopPropagation()}
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
      {ghost
        ? createPortal(
            <div
              className="stop-drag-ghost"
              style={{
                width: ghost.width,
                height: ghost.height,
                transform: `translate3d(${ghost.x}px, ${ghost.y}px, 0)`,
              }}
              aria-hidden="true"
              dangerouslySetInnerHTML={{ __html: ghost.html }}
            />,
            document.body,
          )
        : null}
    </>
  );
}
