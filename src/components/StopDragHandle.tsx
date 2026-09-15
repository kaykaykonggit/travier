import { useEffect, useRef } from "react";

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
      if (clientY >= rect.top - 12 && clientY <= rect.bottom + 12) {
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
    ghost.style.transform = `translate3d(${x}px, ${y}px, 0)`;
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
      moveGhost(event.clientX - offsetRef.current.x, event.clientY - offsetRef.current.y);
    }

    function onUp(event: PointerEvent) {
      if (!draggingRef.current) return;
      if (pointerIdRef.current != null && event.pointerId !== pointerIdRef.current) return;
      draggingRef.current = false;
      pointerIdRef.current = null;
      const to = lastTo.current;
      const from = fromRef.current;
      cleanupDragClasses();
      if (to !== from) onReorderRef.current(from, to);
    }

    window.addEventListener("pointermove", onMove, { passive: false });
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      cleanupDragClasses();
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
      x: Math.min(Math.max(event.clientX - rect.left, 12), Math.max(rect.width - 12, 12)),
      y: Math.min(Math.max(event.clientY - rect.top, 8), Math.max(rect.height - 8, 8)),
    };
    sourceLiRef.current = li;
    li.classList.add("is-drag-source");
    document.body.classList.add("is-reordering-stops");
    event.currentTarget.classList.add("is-dragging");

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
      className="stop-drag-handle"
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
  );
}
