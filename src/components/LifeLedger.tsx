import { useEffect, useMemo, useState } from "react";
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
import { formatDateZh } from "../lib/labels";
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
  onChange,
  onDelete,
}: {
  item: ExpenseItem;
  onChange: (patch: Partial<Omit<ExpenseItem, "id" | "link">>) => void;
  onDelete: () => void;
}) {
  const [amountDraft, setAmountDraft] = useState(item.amount == null || item.amount === 0 ? "" : String(item.amount));
  useEffect(() => {
    setAmountDraft(item.amount == null || item.amount === 0 ? "" : String(item.amount));
  }, [item.amount]);

  function commitAmount() {
    const next = parseAmountInput(amountDraft);
    if (amountDraft.trim() && next == null) return;
    onChange({ amount: next });
  }

  const cat = LIFE_CATEGORIES.find((row) => row.id === item.category);

  return (
    <article className={`life-card life-${item.category}`}>
      <header className="life-card-head">
        <span className="life-chip" aria-hidden>
          {cat?.label ?? "·"}
        </span>
        <div className="life-card-title">
          <input
            className="life-title-input"
            value={item.title}
            placeholder={item.link?.kind === "hotel" ? "酒店名" : item.link?.kind === "flight" ? "航班／機場" : "名稱"}
            onChange={(event) => onChange({ title: event.target.value })}
          />
          <small>
            {cat?.hint}
            {item.link ? " · 連行程" : ""}
          </small>
        </div>
        {!item.link ? (
          <button type="button" className="text-btn life-delete" onClick={onDelete}>
            刪除
          </button>
        ) : null}
      </header>

      <div className="life-grid">
        <Field label="日期">
          <input type="date" value={item.date} onChange={(event) => onChange({ date: event.target.value })} />
        </Field>
        <Field label="時間">
          <input type="time" value={item.time ?? ""} onChange={(event) => onChange({ time: event.target.value || null })} />
        </Field>
        <Field label="地點">
          <input value={item.place} placeholder="城市／區域／機場" onChange={(event) => onChange({ place: event.target.value })} />
        </Field>
        <Field label="幣別">
          <input value={item.currency} maxLength={3} onChange={(event) => onChange({ currency: event.target.value.toUpperCase() })} />
        </Field>
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
      </div>
      <p className="life-card-foot">
        {item.amount != null && item.amount > 0 ? formatMoney(item.amount, item.currency) : "未填價錢"}
        {item.notes ? ` · ${item.notes}` : ""}
      </p>
    </article>
  );
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
      <header className="life-top">
        <p className="brand sm">Travier</p>
        <h1>衣食住行玩</h1>
        <p className="life-lead">同行程時間軸分開。酒店／機票喺呢度填實價；亦可以加餐、門票、購物。</p>
        <div className="life-summary">
          <div>
            <span>全團已填</span>
            <strong>{formatMoney(summary.totalDisplay, display)}</strong>
          </div>
          <div>
            <span>人均</span>
            <strong>{formatMoney(summary.perPersonDisplay, display)}</strong>
          </div>
          <div>
            <span>住／行</span>
            <strong>
              住欠 {miss.hotelMiss}/{miss.hotels} · 行欠 {miss.flightMiss}/{miss.flights}
            </strong>
          </div>
        </div>
      </header>

      <div className="life-cats" role="tablist" aria-label="分類">
        <button type="button" className={filter === "all" ? "on" : ""} onClick={() => setFilter("all")}>
          全部
        </button>
        {LIFE_CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            type="button"
            className={filter === cat.id ? "on" : ""}
            title={cat.hint}
            onClick={() => setFilter(cat.id)}
          >
            <i>{cat.label}</i>
            <span>{cat.hint}</span>
          </button>
        ))}
      </div>

      <div className="life-add">
        {LIFE_CATEGORIES.map((cat) => (
          <button key={cat.id} type="button" className="life-add-btn" onClick={() => onChange(addExpense(ready, cat.id))}>
            ＋{cat.label}
          </button>
        ))}
      </div>

      <div className="life-list">
        {rows.length === 0 ? <p className="empty">呢類未有項目。撳上面「＋」加一筆。</p> : null}
        {rows.map((item) => (
          <ExpenseCard
            key={item.id}
            item={item}
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
