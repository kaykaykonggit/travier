import { useEffect, useMemo, useState } from "react";
import { EditBar } from "./EditBar";
import { LifeGlyph } from "./LifeIcons";
import {
  LIFE_CATEGORIES,
  addExpense,
  deleteExpense,
  ensureLifeExpenses,
  expenseLinkHref,
  expenseLinkLabel,
  expenseUrlPlaceholder,
  normalizeExpenseUrl,
  parseAmountInput,
  updateExpense,
  type ExpenseItem,
  type LifeCategory,
} from "../lib/life";
import { formatMoney, partySize, summarizeCosts, type RateTable } from "../lib/costs";
import { dateDayNumber, formatDateZh, tripDayNumber, weekdayZh } from "../lib/labels";
import { withKlookCountry } from "../lib/klook";
import { klookUrl } from "../lib/links";
import { dayColor } from "../lib/stops";
import { PlaceSuggest } from "./PlaceSuggest";
import type { TripDoc } from "../types";

function Field({ label, children, main }: { label: string; children: React.ReactNode; main?: boolean }) {
  return (
    <label className={`life-field${main ? " is-main" : ""}`}>
      <span>{label}</span>
      {children}
    </label>
  );
}

function ViewRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="life-view-row">
      <span>{label}</span>
      {children}
    </div>
  );
}

function snapshotOf(item: ExpenseItem) {
  return {
    title: item.title,
    place: item.place,
    date: item.date,
    time: item.time,
    currency: item.currency,
    notes: item.notes,
    url: item.url ?? "",
    amountText: item.amount == null || item.amount === 0 ? "" : String(item.amount),
  };
}

function ExpenseCard({
  item,
  startDate,
  biasQuery,
  editing,
  onEdit,
  onSave,
  onCancel,
  onDelete,
}: {
  item: ExpenseItem;
  startDate: string;
  biasQuery: string;
  editing: boolean;
  onEdit: () => void;
  onSave: (patch: Partial<Omit<ExpenseItem, "id" | "link">>) => void;
  onCancel: () => void;
  onDelete: () => void;
}) {
  const [draft, setDraft] = useState(() => snapshotOf(item));
  const [extraOpen, setExtraOpen] = useState(false);

  useEffect(() => {
    if (editing) setDraft(snapshotOf(item));
    // Snapshot once when this card enters edit; ignore later parent refreshes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing, item.id]);

  function save() {
    const amount = parseAmountInput(draft.amountText);
    if (draft.amountText.trim() && amount == null) return;
    onSave({
      title: draft.title,
      place: draft.place,
      date: draft.date,
      time: draft.time,
      amount,
      currency: draft.currency,
      notes: draft.notes,
      url: normalizeExpenseUrl(draft.url),
    });
  }

  const cat = LIFE_CATEGORIES.find((row) => row.id === item.category);
  const dateNo = dateDayNumber(item.date);
  const tripDay = tripDayNumber(item.date, startDate);
  const weekday = weekdayZh(item.date);
  const href = item.url ? expenseLinkHref(item.url) : "";
  const klookSearch = klookUrl(
    withKlookCountry(draft.title || cat?.hint || "experience", draft.place || draft.title || ""),
    draft.date,
  );

  return (
    <article className={`life-card life-${item.category}${editing ? " is-editing" : ""}`}>
      <header className="life-card-head">
        <span
          className="life-chip life-day"
          style={{ background: tripDay > 0 ? dayColor(tripDay - 1) : undefined }}
          aria-label={`${dateNo} 週${weekday}`}
        >
          <strong>{dateNo > 0 ? dateNo : "–"}</strong>
          <em>週{weekday}</em>
        </span>
        <div className="life-card-title">
          {editing ? (
            <input
              className="life-title-input"
              value={draft.title}
              placeholder={item.link?.kind === "hotel" ? "酒店名稱" : item.link?.kind === "flight" ? "航班／機場" : "名稱"}
              onChange={(event) => setDraft({ ...draft, title: event.target.value })}
            />
          ) : (
            <h3 className="life-title-view">{item.title.trim() || "未命名"}</h3>
          )}
          <small>
            {formatDateZh(item.date)}
            {cat?.hint ? ` · ${cat.hint}` : ""}
            {item.link ? " · 連行程" : ""}
          </small>
        </div>
        <div className="life-card-actions">
          <EditBar editing={editing} onEdit={onEdit} onSave={save} onCancel={onCancel} />
          {editing && !item.link ? (
            <button type="button" className="text-btn life-delete" onClick={onDelete}>
              刪除
            </button>
          ) : null}
        </div>
      </header>

      {editing ? (
        <>
          <div className={`life-grid${extraOpen ? " open" : ""}`}>
            <Field main label={item.category === "zhu" ? "價錢（一房一晚）" : item.link?.kind === "flight" ? "價錢（全團）" : "價錢"}>
              <input
                inputMode="decimal"
                value={draft.amountText}
                placeholder="實價"
                onChange={(event) => setDraft({ ...draft, amountText: event.target.value })}
              />
            </Field>
            <Field main label="地點">
              <PlaceSuggest
                value={draft.place}
                biasQuery={biasQuery}
                placeholder="打字搜尋，或貼上 Google 地圖連結"
                onPlace={(place) => setDraft({ ...draft, place })}
                onPick={(place, name) => setDraft({ ...draft, place, title: draft.title.trim() ? draft.title : name })}
              />
            </Field>
            <Field main label="連結">
              <div className="life-link-row">
                <input
                  inputMode="url"
                  value={draft.url}
                  placeholder={expenseUrlPlaceholder(item.category)}
                  onChange={(event) => setDraft({ ...draft, url: event.target.value })}
                />
                {item.category === "wan" ? (
                  <a className="life-klook-hint" href={klookSearch} target="_blank" rel="noreferrer">
                    Klook
                  </a>
                ) : null}
              </div>
            </Field>
            <Field label="日期">
              <input type="date" value={draft.date} onChange={(event) => setDraft({ ...draft, date: event.target.value })} />
            </Field>
            <Field label="時間">
              <input
                type="time"
                value={draft.time ?? ""}
                onChange={(event) => setDraft({ ...draft, time: event.target.value || null })}
              />
            </Field>
            <Field label="幣別">
              <input
                value={draft.currency}
                maxLength={3}
                onChange={(event) => setDraft({ ...draft, currency: event.target.value.toUpperCase() })}
              />
            </Field>
          </div>
          <button type="button" className="life-more-toggle" onClick={() => setExtraOpen((on) => !on)}>
            {extraOpen ? "收起日期時間" : "日期、時間、幣別"}
          </button>
        </>
      ) : (
        <div className="life-view-rows">
          <ViewRow label={item.category === "zhu" ? "價錢（一房一晚）" : item.link?.kind === "flight" ? "價錢（全團）" : "價錢"}>
            <strong>{item.amount != null && item.amount > 0 ? formatMoney(item.amount, item.currency) : "未填寫"}</strong>
          </ViewRow>
          <ViewRow label="地點">
            <strong>{item.place.trim() || "未填寫"}</strong>
          </ViewRow>
          <ViewRow label="連結">
            {href ? (
              <a className="life-link" href={href} target="_blank" rel="noreferrer">
                {expenseLinkLabel(item.url)}
              </a>
            ) : (
              <strong>未有連結</strong>
            )}
          </ViewRow>
        </div>
      )}
      <p className="life-card-foot">
        {item.amount != null && item.amount > 0 ? formatMoney(item.amount, item.currency) : "未填寫價錢"}
        {item.notes ? ` · ${item.notes}` : ""}
      </p>
    </article>
  );
}

function cityBias(doc: TripDoc, date: string): string {
  const day = doc.days.find((item) => item.date === date);
  if (day?.stayCity) {
    const country = day.countries[0] || doc.trip.origin.country;
    return country ? `${day.stayCity}, ${country}` : day.stayCity;
  }
  return [doc.trip.origin.city, doc.trip.origin.country].filter(Boolean).join(", ");
}

function isBlankExpense(item: ExpenseItem): boolean {
  return !item.link && !item.title.trim() && !item.place.trim() && !(item.url ?? "").trim() && (item.amount == null || item.amount === 0);
}

export function LifeLedger({
  doc,
  rates,
  onChange,
}: {
  doc: TripDoc;
  rates: RateTable;
  onChange: (doc: TripDoc) => void;
}) {
  const [filter, setFilter] = useState<LifeCategory | "all">("all");
  const [totalsOpen, setTotalsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const ready = useMemo(() => ensureLifeExpenses(doc), [doc]);
  const heads = partySize(ready.trip.travelers.adults, ready.trip.travelers.children);
  const summary = useMemo(() => summarizeCosts(ready, rates, heads), [ready, rates, heads]);
  const display = ready.trip.currencies.display;

  useEffect(() => {
    if (doc.expenses == null) onChange(ready);
  }, [doc.expenses, onChange, ready]);

  const rows = useMemo(() => {
    const list = ready.expenses ?? [];
    const filtered = filter === "all" ? list : list.filter((item) => item.category === filter);
    return [...filtered].sort((a, b) => `${a.date}${a.time ?? ""}`.localeCompare(`${b.date}${b.time ?? ""}`));
  }, [ready.expenses, filter]);

  const miss = useMemo(() => {
    const hotels = (ready.expenses ?? []).filter((item) => item.link?.kind === "hotel");
    const flights = (ready.expenses ?? []).filter((item) => item.link?.kind === "flight");
    return {
      hotelMiss: hotels.filter((item) => item.amount == null || item.amount <= 0).length,
      flightMiss: flights.filter((item) => item.amount == null || item.amount <= 0).length,
      hotels: hotels.length,
      flights: flights.length,
    };
  }, [ready.expenses]);

  function addRow(category: LifeCategory) {
    const next = addExpense(ready, category);
    const id = next.expenses?.[0]?.id ?? null;
    onChange(next);
    setEditingId(id);
  }

  function cancelEdit(item: ExpenseItem) {
    if (isBlankExpense(item)) onChange(deleteExpense(ready, item.id));
    setEditingId(null);
  }

  return (
    <div className="life-page">
      <div className="life-sticky">
        <div className="life-sticky-row">
          <h1>衣食住行</h1>
          <button
            type="button"
            className="life-totals-toggle"
            aria-expanded={totalsOpen}
            onClick={() => setTotalsOpen((on) => !on)}
          >
            <span>
              全團 {formatMoney(summary.totalDisplay, display)}
              <small>人均 {formatMoney(summary.perPersonDisplay, display)}</small>
            </span>
            {totalsOpen ? "收起" : "展開"}
          </button>
        </div>
        {totalsOpen ? (
          <div className="life-summary">
            <div>
              <span>全團已填寫</span>
              <strong>{formatMoney(summary.totalDisplay, display)}</strong>
            </div>
            <div>
              <span>人均</span>
              <strong>{formatMoney(summary.perPersonDisplay, display)}</strong>
            </div>
            <div className="life-miss-card">
              <span>住宿／交通未填寫</span>
              <strong>
                住宿 {miss.hotelMiss}/{miss.hotels} · 交通 {miss.flightMiss}/{miss.flights}
              </strong>
            </div>
            <p className="life-summary-note">
              住宿尚缺 {miss.hotelMiss}/{miss.hotels} · 交通尚缺 {miss.flightMiss}/{miss.flights}
              。住＝一房一晚；機票＝全團總額。
            </p>
          </div>
        ) : null}
        <div className="life-cats" role="tablist" aria-label="分類">
          <button type="button" className={filter === "all" ? "on" : ""} onClick={() => setFilter("all")} aria-label="全部">
            <LifeGlyph id="all" />
            <span>全部</span>
          </button>
          {LIFE_CATEGORIES.map((row) => (
            <button
              key={row.id}
              type="button"
              className={filter === row.id ? "on" : ""}
              aria-label={`${row.label}，${row.hint}`}
              onClick={() => setFilter(row.id)}
            >
              <LifeGlyph id={row.id} />
              <span>{row.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="life-add">
        {(filter === "all" ? LIFE_CATEGORIES : LIFE_CATEGORIES.filter((row) => row.id === filter)).map((row) => (
          <button key={row.id} type="button" className="life-add-btn" onClick={() => addRow(row.id)} aria-label={row.addLabel}>
            <LifeGlyph id={row.id} />
            ＋{row.label}
          </button>
        ))}
      </div>

      <div className="life-list">
        {rows.length === 0 ? <p className="empty">尚無此類項目。請點擊上方「＋」新增一筆。</p> : null}
        {rows.map((item) => (
          <ExpenseCard
            key={item.id}
            item={item}
            startDate={ready.trip.startDate}
            biasQuery={cityBias(ready, item.date)}
            editing={editingId === item.id}
            onEdit={() => setEditingId(item.id)}
            onSave={(next) => {
              onChange(updateExpense(ready, item.id, next));
              setEditingId(null);
            }}
            onCancel={() => cancelEdit(item)}
            onDelete={() => {
              onChange(deleteExpense(ready, item.id));
              setEditingId(null);
            }}
          />
        ))}
      </div>

      <p className="life-footnote">
        {formatDateZh(ready.trip.startDate)} – {formatDateZh(ready.trip.endDate)} · 住＝一房一晚 · 機票＝全團總額
      </p>
    </div>
  );
}
