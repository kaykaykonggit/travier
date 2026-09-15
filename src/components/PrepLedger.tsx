import { useEffect, useMemo, useState } from "react";
import {
  PREP_SECTIONS,
  addPrepItem,
  deletePrepItem,
  ensurePrep,
  prepProgress,
  togglePrepDone,
  type PrepSection,
} from "../lib/prep";
import type { TripDoc } from "../types";
import { PrepGlyph } from "./LifeIcons";

type Filter = PrepSection | "all";

export function PrepLedger({ doc, onChange }: { doc: TripDoc; onChange: (doc: TripDoc) => void }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [draftTitle, setDraftTitle] = useState("");
  const [draftSection, setDraftSection] = useState<PrepSection>("him_pack");
  const [draftGroup, setDraftGroup] = useState("");
  const ready = useMemo(() => ensurePrep(doc), [doc]);
  const items = ready.prep ?? [];
  const progress = useMemo(() => prepProgress(items), [items]);

  useEffect(() => {
    if (doc.prep == null) onChange(ready);
  }, [doc.prep, onChange, ready]);

  useEffect(() => {
    if (filter !== "all") setDraftSection(filter);
  }, [filter]);

  const groups = useMemo(() => {
    const filtered = filter === "all" ? items : items.filter((item) => item.section === filter);
    const order: string[] = [];
    const map = new Map<string, typeof filtered>();
    for (const item of filtered) {
      const key = item.group.trim() || "其他";
      if (!map.has(key)) {
        map.set(key, []);
        order.push(key);
      }
      map.get(key)!.push(item);
    }
    return order.map((group) => ({ group, items: map.get(group)! }));
  }, [items, filter]);

  function submitAdd() {
    const title = draftTitle.trim();
    if (!title) return;
    onChange(addPrepItem(ready, { section: draftSection, group: draftGroup, title }));
    setDraftTitle("");
  }

  return (
    <div className="life-page prep-page">
      <div className="life-sticky">
        <div className="life-sticky-row">
          <h1>預備清單</h1>
          <p className="prep-progress" aria-live="polite">
            已勾 {progress.done}/{progress.total}
          </p>
        </div>
        <div className="life-cats" role="tablist" aria-label="預備分類">
          <button type="button" className={filter === "all" ? "on" : ""} onClick={() => setFilter("all")}>
            <PrepGlyph />
            <span>全部</span>
          </button>
          {PREP_SECTIONS.map((row) => (
            <button
              key={row.id}
              type="button"
              className={filter === row.id ? "on" : ""}
              aria-label={`${row.label}，${row.hint}`}
              onClick={() => setFilter(row.id)}
            >
              <span className="prep-sec-mark" aria-hidden="true">
                {row.label.slice(0, 1)}
              </span>
              <span>{row.label}</span>
            </button>
          ))}
        </div>
      </div>

      <form
        className="prep-add"
        onSubmit={(event) => {
          event.preventDefault();
          submitAdd();
        }}
      >
        <label className="prep-add-field">
          <span>分類</span>
          <select value={draftSection} onChange={(event) => setDraftSection(event.target.value as PrepSection)}>
            {PREP_SECTIONS.map((row) => (
              <option key={row.id} value={row.id}>
                {row.label}
              </option>
            ))}
          </select>
        </label>
        <label className="prep-add-field">
          <span>分組</span>
          <input
            value={draftGroup}
            placeholder="例如：電子、衣物（可留空）"
            onChange={(event) => setDraftGroup(event.target.value)}
          />
        </label>
        <label className="prep-add-field is-main">
          <span>項目</span>
          <div className="prep-add-row">
            <input
              value={draftTitle}
              placeholder="輸入要帶／要做的項目"
              onChange={(event) => setDraftTitle(event.target.value)}
            />
            <button type="submit" className="btn btn-primary prep-add-btn" disabled={!draftTitle.trim()}>
              加入
            </button>
          </div>
        </label>
      </form>

      <div className="prep-list">
        {groups.length === 0 ? <p className="empty">尚無項目。可在上方加入。</p> : null}
        {groups.map(({ group, items: rows }) => (
          <section key={group} className="prep-group">
            <h2>{group}</h2>
            <ul>
              {rows.map((item) => (
                <li key={item.id} className={item.done ? "is-done" : ""}>
                  <label className="prep-check">
                    <input
                      type="checkbox"
                      checked={item.done}
                      onChange={() => onChange(togglePrepDone(ready, item.id))}
                    />
                    <span>{item.title}</span>
                  </label>
                  <button
                    type="button"
                    className="text-btn prep-delete"
                    aria-label={`刪除 ${item.title}`}
                    onClick={() => onChange(deletePrepItem(ready, item.id))}
                  >
                    刪除
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <p className="life-footnote">可勾選、新增或刪除。資料會隨行程一併儲存在本機。</p>
    </div>
  );
}
