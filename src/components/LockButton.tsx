export function LockButton({ locked, onToggle }: { locked: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      className={`lock-icon ${locked ? "is-locked" : "is-open"}`}
      onClick={(event) => {
        event.stopPropagation();
        onToggle();
      }}
      aria-label={locked ? "解鎖此點" : "鎖住此點"}
      title={locked ? "解鎖後可改後備或加入下一站" : "再按一次鎖住"}
    >
      {locked ? (
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden>
          <path fill="currentColor" d="M17 8V7a5 5 0 0 0-10 0v1H5v14h14V8h-2Zm-8 0V7a3 3 0 0 1 6 0v1H9Zm3 9a2 2 0 1 1 0-4 2 2 0 0 1 0 4Z" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden>
          <path fill="currentColor" d="M17 8h2v14H5V8h2V7a5 5 0 0 1 9.8-1.4l-1.7.7A3 3 0 0 0 9 7v1h8Zm-5 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" />
        </svg>
      )}
    </button>
  );
}
