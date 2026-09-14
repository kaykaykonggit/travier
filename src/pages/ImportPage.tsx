import { useEffect, useState } from "react";
import { InfoTip } from "../components/InfoTip";
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
        <p className="import-sample">揀一個範本即刻行完成程；沖繩版用地名較齊，地圖較少缺號。</p>
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
        <div className="tweak-row">
          <span className="import-label">用法</span>
          <InfoTip title="點樣自己規劃">
            <ol>
              <li>Travier 自己唔會叫 AI；你要喺外面開會搜網嘅 AI。</li>
              <li>填好下面行程條件 → 撳「複製計劃」。</li>
              <li>貼去 AI，叫佢跟規格只輸出一份完整行程 JSON（唔好 Markdown）。</li>
              <li>將 JSON 貼返最下面「貼上 AI JSON」→「匯入行程」。</li>
              <li>之後要微調：去行程頁「微改行程」（AI 只交細份 patch，手機快啲）。</li>
            </ol>
            <p>手上已有行程文字：用「只複製規格」，再叫 AI 轉成 Travier JSON。</p>
          </InfoTip>
        </div>
        <section className="plan-section first">
          <div className="tweak-row">
            <p className="import-label">行程條件</p>
            <InfoTip title="行程條件">
              <p>呢度填嘅日期、人數、節奏、想去邊，會一齊寫入「複製計劃」俾 AI。</p>
              <p>改完條件要再撳一次「複製計劃」，唔好用舊剪貼簿。</p>
              <p>節奏愈 packed，每日景點會愈密；放鬆啲就留多啲步行／休息。</p>
            </InfoTip>
          </div>
          <PlannerForm brief={brief} onChange={setBrief} />
          <div className="import-actions">
            <button type="button" className="btn btn-primary" onClick={() => copyText(buildPlannerPrompt(brief), "plan")}>
              {copied === "plan" ? "已複製" : "複製計劃"}
            </button>
            <button type="button" className="text-btn" onClick={() => copyText(AI_TEMPLATE, "spec")}>
              {copied === "spec" ? "已複製" : "只複製規格"}
            </button>
            <InfoTip title="兩個複製掣">
              <p>
                <strong>複製計劃</strong>：你填嘅條件＋完整 JSON 規格。適合由零叫 AI 規劃。
              </p>
              <p>
                <strong>只複製規格</strong>：淨係規格、冇條件。適合你已有行程文字／Excel，叫 AI 轉成可匯入嘅 JSON。
              </p>
              <p>兩個掣都唔會自動叫 AI；要你自己貼去外面嘅 AI chat。</p>
            </InfoTip>
          </div>
        </section>
        <section className="plan-section">
          <div className="tweak-row">
            <label className="import-label" htmlFor="trip-json">
              貼上 AI JSON
            </label>
            <InfoTip title="匯入 JSON">
              <p>呢格只要<strong>完整行程</strong>：至少有 <code>schemaVersion</code>、<code>trip</code>、<code>days</code>。</p>
              <p>匯入頁<strong>唔收</strong>微改 patch（<code>1.0.0-patch</code>）。已經有行程要微調，去行程頁「微改行程」貼。</p>
              <p>若匯入失敗：檢查 AI 有冇加前言／```；要淨 JSON。常見錯係 true/false 後面多咗字，或連結寫成 Markdown。</p>
            </InfoTip>
          </div>
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
