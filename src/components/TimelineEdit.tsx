import { useEffect, useState } from "react";
import { formatMoney } from "../lib/costs";
import { googleDirExploreUrl, looksLikeMapsLink } from "../lib/links";
import { resolvePlaceInput } from "../lib/resolvePlace";
import type { BackupPlace, TimelineItem } from "../types";

export function TimelineEdit({
  item,
  onBackup,
  onDelete,
  onAddPlace,
}: {
  item: TimelineItem;
  onBackup: (backup: BackupPlace) => void;
  onDelete: () => void;
  onAddPlace: (place: { name: string; placeQuery: string; source?: string | null; imageUrl?: string | null }) => void;
}) {
  const [paste, setPaste] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (item.locked) return;
    function readClip() {
      if (!navigator.clipboard?.readText) return;
      navigator.clipboard.readText().then((text) => {
        if (looksLikeMapsLink(text) || text.trim().startsWith("http")) setPaste(text.trim());
      }).catch(() => {
        /* 瀏覽器未准讀剪貼簿 */
      });
    }
    function onVis() {
      if (!document.hidden) readClip();
    }
    window.addEventListener("focus", readClip);
    document.addEventListener("visibilitychange", onVis);
    readClip();
    return () => {
      window.removeEventListener("focus", readClip);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [item.locked, item.placeQuery]);

  async function confirmPaste() {
    setBusy(true);
    setError("");
    const cityHint = item.placeQuery.split(",").slice(1).join(",").trim();
    const resolved = await resolvePlaceInput(paste, cityHint);
    setBusy(false);
    if (!resolved) {
      setError("讀取不到地名。請改貼完整的 Google 地圖網址，或直接輸入英文景點名稱。");
      return;
    }
    onAddPlace(resolved);
    setPaste("");
  }

  if (item.locked) return null;

  return (
    <div className="spot-edit" onClick={(event) => event.stopPropagation()}>
      <div className="spot-tools">
        {item.backups.length > 0 && (
          <div className="backups">
            <p>備用景點</p>
            {item.backups.map((backup) => (
              <button type="button" key={backup.placeQuery} onClick={() => onBackup(backup)}>
                <strong>{backup.displayNameZh || backup.title}</strong>
                {backup.why ? <span>{backup.why}</span> : null}
                {backup.ticket.cost.amount != null ? (
                  <span>{formatMoney(backup.ticket.cost.amount, backup.ticket.cost.currency)}</span>
                ) : null}
              </button>
            ))}
          </div>
        )}
        <div className="spot-actions">
          <a href={googleDirExploreUrl(item.placeQuery || item.title)} target="_blank" rel="noreferrer" className="add-spot">
            ＋ 在 Google 地圖尋找下一站
          </a>
          <button type="button" className="text-btn danger" onClick={onDelete}>
            刪除此點
          </button>
        </div>
        <p className="empty">在地圖選好地點後複製連結，回到這裡將會嘗試自動貼上並讀取地名。</p>
        <form
          className="hotel-pick"
          onSubmit={(event) => {
            event.preventDefault();
            void confirmPaste();
          }}
        >
          <input
            value={paste}
            onChange={(event) => setPaste(event.target.value)}
            placeholder="貼上 Google 地圖連結或下一站英文名稱"
          />
          <button type="submit" className="text-btn" disabled={!paste.trim() || busy}>
            {busy ? "正在讀取地名…" : "加入行程"}
          </button>
        </form>
        {error ? <p className="import-errors">{error}</p> : null}
        <p className="empty">加入後會補上步行路線。票價與車資尚未搜尋，可之後再讓 AI 補上。</p>
      </div>
    </div>
  );
}
