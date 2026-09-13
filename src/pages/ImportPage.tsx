import { useEffect, useState } from "react";
import { PlannerForm } from "../components/PlannerForm";
import { parseTripDoc, parseTripJson } from "../lib/parse";
import { buildPlannerPrompt, loadBrief, saveBrief, type TripBrief } from "../lib/planner";
import { AI_TEMPLATE } from "../lib/template";
import { deleteSavedTrip, listSavedTrips, loadSavedTrip, type SavedTripMeta } from "../lib/storage";
import type { TripDoc } from "../types";
import austriaSample from "../../examples/austria-italy-christmas-2026.json";
import okinawaSample from "../../examples/okinawa-6d5n-2026.json";

export function ImportPage({ onImport }: { onImport: (doc: TripDoc) => void }) {
  const [brief, setBrief] = useState<TripBrief>(() => loadBrief());
  const [text, setText] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [copied, setCopied] = useState<"plan" | "spec" | null>(null);
  const [saved, setSaved] = useState<SavedTripMeta[]>(() => listSavedTrips());

  useEffect(() => {
    saveBrief(brief);
  }, [brief]);

  function handleParse(raw: string) {
    const result = parseTripJson(raw);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors([]);
    onImport(result.doc);
  }

  async function copyText(value: string, kind: "plan" | "spec") {
    await navigator.clipboard.writeText(value);
    setCopied(kind);
    window.setTimeout(() => setCopied(null), 2000);
  }

  function loadSample(data: unknown) {
    const result = parseTripDoc(data);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors([]);
    onImport(result.doc);
  }

  function openSaved(id: string) {
    const doc = loadSavedTrip(id);
    if (!doc) {
      setErrors(["搵唔到呢份已封存行程。"]);
      setSaved(listSavedTrips());
      return;
    }
    setErrors([]);
    onImport(doc);
  }

  function removeSaved(id: string) {
    deleteSavedTrip(id);
    setSaved(listSavedTrips());
  }

  return (
    <div className="import-page">
      <header className="import-hero">
        <p className="brand">Travier</p>
        <h1>出門嗰日，電話只顯示下一站。</h1>
        <p className="lead">地圖、今晚酒店、景點附近食嘢同訂位，唔使臨場先開 Google 先諗去邊食。</p>
        <ul className="import-points">
          <li>而家／下一站，同日曆地圖</li>
          <li>今晚酒店一卡睇晒</li>
          <li>同一帶早餐、午餐、下午茶、晚餐提早訂</li>
        </ul>
        <div className="sample-actions">
          <button type="button" className="btn btn-primary" onClick={() => loadSample(okinawaSample)}>
            沖繩 6天5夜範本
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => loadSample(austriaSample)}>
            奧地利 × 意大利聖誕範本
          </button>
        </div>
        <p className="import-sample">範本撳完就可以行完成程；沖繩版已用日文地名，減少地圖缺號。</p>
      </header>

      {saved.length > 0 && (
        <section className="saved-trips panel">
          <div className="panel-head">
            <h2>本機已封存</h2>
            <span>未有後端，暫存在呢部裝置／瀏覽器</span>
          </div>
          <ul className="saved-list">
            {saved.map((item) => (
              <li key={item.id}>
                <div>
                  <strong>{item.title}</strong>
                  <small>
                    {item.startDate} – {item.endDate} · 封存於 {item.savedAt.slice(0, 16).replace("T", " ")}
                  </small>
                </div>
                <div className="saved-actions">
                  <button type="button" className="btn btn-primary" onClick={() => openSaved(item.id)}>
                    打開
                  </button>
                  <button type="button" className="text-btn" onClick={() => removeSaved(item.id)}>
                    刪除
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <details className="quiet-details plan-later" {...(errors.length > 0 ? { open: true } : {})}>
        <summary>自己規劃／貼 JSON</summary>
        <p className="lead plan-later-lead">
          網站自己唔會叫 AI。填完條件複製去會搜網嘅 AI，佢只交一份 JSON，再貼返下面。已經有行程就匯入之後去行程頁撳「複製微改俾 AI」。
        </p>
        <section className="plan-section first">
          <p className="import-label">行程條件</p>
          <PlannerForm brief={brief} onChange={setBrief} />
          <div className="import-actions">
            <button type="button" className="btn btn-primary" onClick={() => copyText(buildPlannerPrompt(brief), "plan")}>
              {copied === "plan" ? "已複製計劃 + 規格" : "由零規劃：複製計劃 + 規格俾 AI"}
            </button>
            <button type="button" className="text-btn" onClick={() => copyText(AI_TEMPLATE, "spec")}>
              {copied === "spec" ? "已複製規格" : "只複製規格（自己已有行程文字）"}
            </button>
          </div>
        </section>
        <section className="plan-section">
          <label className="import-label" htmlFor="trip-json">
            貼上 AI 交回的 JSON
          </label>
          <textarea
            id="trip-json"
            className="import-box"
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder='{"schemaVersion":"1.0.0","trip":...}'
            spellCheck={false}
          />
          {errors.length > 0 && (
            <ul className="import-errors">
              {errors.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          )}
          <button
            type="button"
            className="btn btn-primary btn-block"
            disabled={!text.trim()}
            onClick={() => handleParse(text)}
          >
            匯入行程
          </button>
        </section>
      </details>
    </div>
  );
}
