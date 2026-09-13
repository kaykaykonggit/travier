import { useMemo, useState } from "react";
import { applyNightHotel, hotelNights } from "../lib/nightHotel";
import { formatDateZh } from "../lib/labels";
import { resolvePlaceInput } from "../lib/resolvePlace";
import type { TripDoc } from "../types";

type Draft = {
  address: string;
  name: string;
  placeQuery: string;
  amount: string;
  status: string;
};

function draftFromDoc(doc: TripDoc): Record<string, Draft> {
  const out: Record<string, Draft> = {};
  for (const night of hotelNights(doc)) {
    const chosen = night.candidates.find((item) => item.name === night.chosenName);
    out[night.date] = {
      address: chosen?.placeQuery || night.nearPlaceQuery || "",
      name: night.chosenName || "",
      placeQuery: chosen?.placeQuery || night.nearPlaceQuery || "",
      amount: chosen?.cost.amount != null ? String(chosen.cost.amount) : "",
      status: night.chosenName ? "已套用" : "",
    };
  }
  return out;
}

export function NightHotelsTable({
  doc,
  onChange,
}: {
  doc: TripDoc;
  onChange: (doc: TripDoc) => void;
}) {
  const nights = useMemo(() => hotelNights(doc), [doc]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>(() => draftFromDoc(doc));
  const [busyDate, setBusyDate] = useState<string | null>(null);

  function patchDraft(date: string, patch: Partial<Draft>) {
    setDrafts((prev) => {
      const current = prev[date] ?? {
        address: "",
        name: "",
        placeQuery: "",
        amount: "",
        status: "",
      };
      return { ...prev, [date]: { ...current, ...patch } };
    });
  }

  async function resolveRow(date: string, city: string) {
    const draft = drafts[date];
    if (!draft?.address.trim()) return;
    setBusyDate(date);
    patchDraft(date, { status: "解析中…" });
    try {
      const resolved = await resolvePlaceInput(draft.address.trim(), city);
      if (!resolved?.name) {
        patchDraft(date, { status: "解析不到，請貼 Google Maps 連結或完整地址" });
        return;
      }
      patchDraft(date, {
        name: resolved.name,
        placeQuery: resolved.placeQuery || resolved.name,
        status: "已解析名稱，填價錢後套用",
      });
    } catch {
      patchDraft(date, { status: "解析失敗" });
    } finally {
      setBusyDate(null);
    }
  }

  function applyRow(date: string) {
    const draft = drafts[date];
    if (!draft) return;
    const name = draft.name.trim() || draft.address.trim();
    const amount = Number(draft.amount);
    if (!name || !Number.isFinite(amount) || amount < 0) {
      patchDraft(date, { status: "請填名稱（或先解析）同當晚價錢" });
      return;
    }
    const placeQuery = draft.placeQuery.trim() || draft.address.trim() || name;
    onChange(
      applyNightHotel(doc, date, {
        name,
        placeQuery,
        amount,
        source: /https?:\/\//i.test(draft.address) ? draft.address.trim() : null,
      }),
    );
    patchDraft(date, { status: "已合併入行程", name, placeQuery });
  }

  if (!nights.length) return null;

  return (
    <section className="panel hotel-board">
      <div className="panel-head">
        <h2>每晚酒店（即時填）</h2>
        <span>貼 Maps 連結 → 解析店名 → 填當晚價錢 → 套用</span>
      </div>
      <div className="hotel-table-wrap">
        <table className="hotel-table">
          <thead>
            <tr>
              <th>日期</th>
              <th>城市</th>
              <th>Google Maps／地址</th>
              <th>酒店名稱</th>
              <th>當晚價錢</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {nights.map((night) => {
              const draft = drafts[night.date] ?? {
                address: "",
                name: "",
                placeQuery: "",
                amount: "",
                status: "",
              };
              return (
                <tr key={night.date}>
                  <td>
                    <strong>{formatDateZh(night.date)}</strong>
                  </td>
                  <td>{night.city}</td>
                  <td>
                    <input
                      value={draft.address}
                      onChange={(event) => patchDraft(night.date, { address: event.target.value })}
                      placeholder="貼 Google Maps 連結或地址"
                    />
                    <button
                      type="button"
                      className="text-btn"
                      disabled={busyDate === night.date || !draft.address.trim()}
                      onClick={() => void resolveRow(night.date, night.city)}
                    >
                      {busyDate === night.date ? "解析中…" : "解析名稱"}
                    </button>
                  </td>
                  <td>
                    <input
                      value={draft.name}
                      onChange={(event) =>
                        patchDraft(night.date, {
                          name: event.target.value,
                          placeQuery: event.target.value,
                        })
                      }
                      placeholder="解析後會填店名"
                    />
                  </td>
                  <td>
                    <input
                      inputMode="decimal"
                      value={draft.amount}
                      onChange={(event) => patchDraft(night.date, { amount: event.target.value })}
                      placeholder={doc.trip.currencies.local}
                    />
                  </td>
                  <td>
                    <button type="button" className="btn btn-primary" onClick={() => applyRow(night.date)}>
                      套用
                    </button>
                    {draft.status ? <small className="hotel-row-status">{draft.status}</small> : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="hotel-board-note">
        套用後會寫入「今晚」酒店標籤、候補名單同花費合計；亦會更新當日時間軸入面嘅住宿站。資料暫存在呢部裝置。
      </p>
    </section>
  );
}
