import { useEffect, useState } from "react";
import {
  listFlightBudgets,
  listHotelBudgets,
  parseAmountInput,
  setFlightTicketCost,
  setHotelNightCost,
} from "../lib/budget";
import { formatMoney } from "../lib/costs";
import { formatDateZh } from "../lib/labels";
import type { TripDoc } from "../types";

function AmountField({
  id,
  label,
  amount,
  currency,
  hint,
  onSave,
}: {
  id: string;
  label: string;
  amount: number | null;
  currency: string;
  hint: string;
  onSave: (amount: number | null) => void;
}) {
  const [draft, setDraft] = useState(amount == null || amount === 0 ? "" : String(amount));
  useEffect(() => {
    setDraft(amount == null || amount === 0 ? "" : String(amount));
  }, [amount]);

  function commit() {
    const next = parseAmountInput(draft);
    if (draft.trim() && next == null) return;
    onSave(next);
  }

  return (
    <div className="budget-row">
      <div className="budget-row-copy">
        <strong>{label}</strong>
        <small>{hint}</small>
      </div>
      <div className="budget-row-edit">
        <label className="budget-amount" htmlFor={id}>
          <span>{currency}</span>
          <input
            id={id}
            inputMode="decimal"
            value={draft}
            placeholder="實價"
            onChange={(event) => setDraft(event.target.value)}
            onBlur={commit}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                (event.target as HTMLInputElement).blur();
              }
            }}
          />
        </label>
        <span className="budget-shown">{amount != null && amount > 0 ? formatMoney(amount, currency) : "未填"}</span>
      </div>
    </div>
  );
}

export function BudgetBoard({ doc, onChange }: { doc: TripDoc; onChange: (doc: TripDoc) => void }) {
  const flights = listFlightBudgets(doc);
  const hotels = listHotelBudgets(doc);
  const flightCurrency = doc.trip.currencies.display;
  const hotelCurrency = doc.trip.currencies.local;
  const flightFilled = flights.filter((row) => row.cost.amount != null && row.cost.amount > 0).length;
  const hotelFilled = hotels.filter((row) => row.cost.amount != null && row.cost.amount > 0).length;

  return (
    <div className="budget-board">
      <p className="budget-lead">
        呢兩項最定死：填你<strong>實際付／已報價</strong>嘅全團機票同每晚一房價，總預算會即時重計。
      </p>

      <section className="budget-section">
        <div className="budget-section-head">
          <h3>機票（全團）</h3>
          <span>
            {flightFilled}/{flights.length || 0} 段已填
          </span>
        </div>
        {flights.length === 0 ? (
          <p className="empty">行程未有 flight 站。匯入／微改時加起飛或回程航班，就可以喺度填實價。</p>
        ) : (
          flights.map((row) => (
            <AmountField
              key={row.key}
              id={`flight-cost-${row.key}`}
              label={row.label}
              amount={row.cost.amount}
              currency={row.cost.currency || flightCurrency}
              hint={`${formatDateZh(row.date)} · 全團總額（唔係一人）`}
              onSave={(amount) => onChange(setFlightTicketCost(doc, row.dayIndex, row.itemIndex, amount, row.cost.currency || flightCurrency))}
            />
          ))
        )}
      </section>

      <section className="budget-section">
        <div className="budget-section-head">
          <h3>酒店（一房一晚）</h3>
          <span>
            {hotelFilled}/{hotels.length || 0} 晚已填
          </span>
        </div>
        {hotels.length === 0 ? (
          <p className="empty">未有酒店晚數。</p>
        ) : (
          hotels.map((row) => (
            <AmountField
              key={row.key}
              id={`hotel-cost-${row.key}`}
              label={row.label}
              amount={row.cost.amount}
              currency={row.cost.currency || hotelCurrency}
              hint={`${formatDateZh(row.date)} · ${row.city} · 一房價（之後除人數）`}
              onSave={(amount) => onChange(setHotelNightCost(doc, row.nightIndex, amount, row.cost.currency || hotelCurrency, row.label))}
            />
          ))
        )}
      </section>
    </div>
  );
}
