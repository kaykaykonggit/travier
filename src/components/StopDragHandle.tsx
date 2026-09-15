import { useEffect, useRef } from "react";

/**
 * Hold-and-drag grip for timeline reorder.
 * Uses non-passive touch listeners so phone browsers don't steal the gesture for scrolling.
 */
export function StopDragHandle({
  index,
  disabled,
  onReorder,
}: {
  index: number;
  disabled?: boolean;
  onReorder: (from: number, to: number) => void;
}) {
  const handleRef = useRef<HTMLButtonElement | null>(null);
  const draggingRef = useRef(false);
  const fromRef = useRef(index);
  const lastTo = useRef(index);
  const pointerIdRef = useRef<number | null>(null);
  const offsetRef = useRef({ x: 0, y: 0 });
  const sourceLiRef = useRef<HTMLElement | null>(null);
  const ghostRef = useRef<HTMLDivElement | null>(null);
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
      if (clientY >= rect.top - 16 && clientY <= rect.bottom + 16) {
        if (!best || dist < best.dist) best = { index: value, dist };
      }
    }
    if (best) return best.index;
    if (!rows.length) return null;
    if (clientY < rows[0].getBoundingClientRect().top) return Number(rows[0].dataset.stopIndex);
    if (clientY > rows[rows.length - 1].getBoundingClientRect().bottom) {
      return Number(rows[rows.length - 1].dataset.stopIndex);
    }
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

  function moveGhost(x: number, y: number) {
    const ghost = ghostRef.current;
    if (!ghost) return;
    ghost.style.transform = `translate3d(${Math.round(x)}px, ${Math.round(y)}px, 0)`;
  }

  function destroyGhost() {
    ghostRef.current?.remove();
    ghostRef.current = null;
  }

  function cleanupDragClasses() {
    clearTargets();
    document.body.classList.remove("is-reordering-stops");
    sourceLiRef.current?.classList.remove("is-drag-source");
    sourceLiRef.current = null;
    handleRef.current?.classList.remove("is-dragging");
    destroyGhost();
  }

  function finishDrag() {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    pointerIdRef.current = null;
    const to = lastTo.current;
    const from = fromRef.current;
    cleanupDragClasses();
    if (to !== from) onReorderRef.current(from, to);
  }

  function updateDragPosition(clientX: number, clientY: number) {
    if (!draggingRef.current) return;
    const target = rowIndexFromPoint(clientY);
    if (target != null && target !== lastTo.current) {
      lastTo.current = target;
      markTarget(target);
    }
    moveGhost(clientX - offsetRef.current.x, clientY - offsetRef.current.y);
  }

  function beginDrag(clientX: number, clientY: number, pointerId: number | null) {
    const handle = handleRef.current;
    if (!handle || disabled) return false;
    const li = handle.closest<HTMLElement>(".timeline-stop[data-stop-index]");
    const row = li?.querySelector<HTMLElement>(".stop-compact-row") ?? li;
    if (!li || !row) return false;

    const rect = row.getBoundingClientRect();
    fromRef.current = index;
    lastTo.current = index;
    draggingRef.current = true;
    pointerIdRef.current = pointerId;
    offsetRef.current = {
      x: Math.min(Math.max(clientX - rect.left, 12), Math.max(rect.width - 12, 12)),
      y: Math.min(Math.max(clientY - rect.top, 8), Math.max(rect.height - 8, 8)),
    };
    sourceLiRef.current = li;
    li.classList.add("is-drag-source");
    document.body.classList.add("is-reordering-stops");
    handle.classList.add("is-dragging");

    destroyGhost();
    const ghost = document.createElement("div");
    ghost.className = "stop-drag-ghost";
    ghost.setAttribute("aria-hidden", "true");
    ghost.style.width = `${rect.width}px`;
    ghost.style.height = `${rect.height}px`;
    ghost.innerHTML = row.innerHTML;
    document.body.appendChild(ghost);
    ghostRef.current = ghost;
    moveGhost(rect.left, rect.top);
    markTarget(index);
    return true;
  }

  // Window-level pointer + non-passive touch so mobile scroll doesn't cancel the drag.
  useEffect(() => {
    function onPointerMove(event: PointerEvent) {
      if (!draggingRef.current) return;
      if (pointerIdRef.current != null && event.pointerId !== pointerIdRef.current) return;
      event.preventDefault();
      updateDragPosition(event.clientX, event.clientY);
    }

    function onPointerUp(event: PointerEvent) {
      if (!draggingRef.current) return;
      if (pointerIdRef.current != null && event.pointerId !== pointerIdRef.current) return;
      finishDrag();
    }

    function onTouchMove(event: TouchEvent) {
      if (!draggingRef.current) return;
      const touch = event.touches[0];
      if (!touch) return;
      event.preventDefault();
      updateDragPosition(touch.clientX, touch.clientY);
    }

    function onTouchEnd() {
      if (!draggingRef.current) return;
      finishDrag();
    }

    window.addEventListener("pointermove", onPointerMove, { passive: false });
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onTouchEnd);
    window.addEventListener("touchcancel", onTouchEnd);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("touchcancel", onTouchEnd);
      cleanupDragClasses();
    };
  }, []);

  // Bind non-passive touchstart on the button itself (React's onTouchStart is passive in many browsers).
  useEffect(() => {
    const handle = handleRef.current;
    if (!handle) return;

    function onTouchStart(event: TouchEvent) {
      if (disabled) return;
      const touch = event.touches[0];
      if (!touch) return;
      event.preventDefault();
      event.stopPropagation();
      beginDrag(touch.clientX, touch.clientY, null);
    }

    handle.addEventListener("touchstart", onTouchStart, { passive: false });
    return () => handle.removeEventListener("touchstart", onTouchStart);
  }, [disabled, index]);

  function onPointerDown(event: React.PointerEvent<HTMLButtonElement>) {
    if (disabled || event.button !== 0) return;
    // Touch is handled by the native touchstart listener above.
    if (event.pointerType === "touch") return;
    event.preventDefault();
    event.stopPropagation();
    if (!beginDrag(event.clientX, event.clientY, event.pointerId)) return;
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      /* window listeners still drive the drag */
    }
  }

  return (
    <button
      ref={handleRef}
      type="button"
      className={`stop-drag-handle${disabled ? " is-disabled" : ""}`}
      aria-label={disabled ? "無法調整順序" : "按住拖曳以調整順序"}
      title={disabled ? "只有一站時不能拖曳" : "按住拖曳"}
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
  );
}
