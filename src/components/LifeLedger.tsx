import { useEffect, useMemo, useState } from "react";
import { LifeGlyph } from "./LifeIcons";
import {
  LIFE_CATEGORIES,
  addExpense,
  deleteExpense,
  ensureLifeExpenses,
  parseAmountInput,
  updateExpense,
  type ExpenseItem,
  type LifeCategory,
} from "../lib/life";
import { formatMoney, partySize, summarizeCosts, type RateTable } from "../lib/costs";
import { dateDayNumber, formatDateZh, tripDayNumber, weekdayZh } from "../lib/labels";
import { dayColor } from "../lib/stops";
import { PlaceSuggest } from "./PlaceSuggest";
import type { TripDoc } from "../types";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="life-field">
      <span>{label}</span>
      {children}
    </label>
  );
}

function ExpenseCard({
  item,
  startDate,
  biasQuery,
  onChange,
  onDelete,
}: {
  item: ExpenseItem;
  startDate: string;
  biasQuery: string;
  onChange: (patch: Partial<Omit<ExpenseItem, "id" | "link">>) => void;
  onDelete: () => void;
}) {
  const [amountDraft, setAmountDraft] = useState(item.amount == null || item.amount === 0 ? "" : String(item.amount));
  const [extraOpen, setExtraOpen] = useState(false);
  useEffect(() => {
    setAmountDraft(item.amount == null || item.amount === 0 ? "" : String(item.amount));
  }, [item.amount]);

  function commitAmount() {
    const next = parseAmountInput(amountDraft);
    if (amountDraft.trim() && next == null) return;
    onChange({ amount: next });
  }

  const cat = LIFE_CATEGORIES.find((row) => row.id === item.category);
  const dateNo = dateDayNumber(item.date);
  const tripDay = tripDayNumber(item.date, startDate);
  const weekday = weekdayZh(item.date);

  return (
    <article className={`life-card life-${item.category}`}>
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
          <input
            className="life-title-input"
            value={item.title}
            placeholder={item.link?.kind === "hotel" ? "酒店名稱" : item.link?.kind === "flight" ? "航班／機場" : "名稱"}
            onChange={(event) => onChange({ title: event.target.value })}
          />
          <small>
            {formatDateZh(item.date)}
            {cat?.hint ? ` · ${cat.hint}` : ""}
            {item.link ? " · 連行程" : ""}
          </small>
        </div>
        {!item.link ? (
          <button type="button" className="text-btn life-delete" onClick={onDelete}>
            刪除
          </button>
        ) : null}
      </header>

      <div className={`life-grid${extraOpen ? " open" : ""}`}>
        <Field label={item.category === "zhu" ? "價錢（一房一晚）" : item.link?.kind === "flight" ? "價錢（全團）" : "價錢"}>
          <input
            inputMode="decimal"
            value={amountDraft}
            placeholder="實價"
            onChange={(event) => setAmountDraft(event.target.value)}
            onBlur={commitAmount}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                (event.target as HTMLInputElement).blur();
              }
            }}
          />
        </Field>
        <Field label="地點">
          <PlaceSuggest
            value={item.place}
            biasQuery={biasQuery}
            placeholder="打字搜尋，或貼上 Google 地圖連結"
            onPlace={(place) => onChange({ place })}
            onPick={(place, name) => onChange({ place, ...(item.title.trim() ? {} : { title: name }) })}
          />
        </Field>
        <Field label="日期">
          <input type="date" value={item.date} onChange={(event) => onChange({ date: event.target.value })} />
        </Field>
        <Field label="時間">
          <input type="time" value={item.time ?? ""} onChange={(event) => onChange({ time: event.target.value || null })} />
        </Field>
        <Field label="幣別">
          <input value={item.currency} maxLength={3} onChange={(event) => onChange({ currency: event.target.value.toUpperCase() })} />
        </Field>
      </div>
      <button type="button" className="life-more-toggle" onClick={() => setExtraOpen((on) => !on)}>
        {extraOpen ? "收起日期時間" : "日期、時間、幣別"}
      </button>
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
          <button
            key={row.id}
            type="button"
            className="life-add-btn"
            onClick={() => onChange(addExpense(ready, row.id))}
            aria-label={row.addLabel}
          >
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
            onChange={(next) => onChange(updateExpense(ready, item.id, next))}
            onDelete={() => onChange(deleteExpense(ready, item.id))}
          />
        ))}
      </div>

      <p className="life-footnote">
        {formatDateZh(ready.trip.startDate)} – {formatDateZh(ready.trip.endDate)} · 住＝一房一晚 · 機票＝全團總額
      </p>
    </div>
  );
}
