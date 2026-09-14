import { useEffect, useState } from "react";
import { InfoTip } from "../components/InfoTip";
import { PlannerForm } from "../components/PlannerForm";
import { parseTripDoc, parseTripJson } from "../lib/parse";
import { buildPlannerPrompt, loadBrief, saveBrief, type TripBrief } from "../lib/planner";
import { AI_TEMPLATE, buildSampleEditPrompt } from "../lib/template";
import { deleteSavedTrip, listSavedTrips, loadSavedTrip, type SavedTripMeta } from "../lib/storage";
import type { TripDoc } from "../types";
import austriaSample from "../../examples/austria-italy-christmas-2026.json";
import okinawaSample from "../../examples/okinawa-6d5n-2026.json";

export function ImportPage({ onImport }: { onImport: (doc: TripDoc) => void }) {
  const [brief, setBrief] = useState<TripBrief>(() => loadBrief());
  const [text, setText] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [copied, setCopied] = useState<"plan" | "spec" | "okinawa" | "austria" | null>(null);
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

  async function copyText(value: string, kind: "plan" | "spec" | "okinawa" | "austria") {
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
      setErrors(["找不到這份已封存行程。"]);
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
        <h1>出發當天，手機只顯示下一站。</h1>
        <p className="lead">地圖、今晚酒店、景點附近美食與訂位，無需臨場才開 Google 搜尋。</p>
        <ul className="import-points">
          <li>現在／下一站，及日曆地圖</li>
          <li>今晚酒店一目了然</li>
          <li>同一帶的早餐、午餐、下午茶、晚餐提早預訂</li>
        </ul>
        <div className="sample-list">
          <article className="cover-card">
            <img
              src="https://images.unsplash.com/photo-1559827260-dc66d52bef19?auto=format&fit=crop&w=1400&q=70"
              alt=""
            />
            <div className="cover-card-shade" />
            <div className="cover-card-body">
              <p className="cover-kicker">日本 · 沖繩</p>
              <h2>沖繩 6天5夜</h2>
              <p>地名較齊全，地圖缺漏較少</p>
              <div className="cover-meta">
                <span>6 天 5 夜</span>
                <span>地圖較齊</span>
              </div>
              <div className="cover-actions">
                <button type="button" className="btn btn-primary" onClick={() => loadSample(okinawaSample)}>
                  打開
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => void copyText(buildSampleEditPrompt("沖繩 6天5夜", okinawaSample), "okinawa")}
                >
                  {copied === "okinawa" ? "已複製" : "複製給 AI"}
                </button>
              </div>
            </div>
          </article>
          <article className="cover-card">
            <img
              src="https://images.unsplash.com/photo-1483728642387-6c3bdd6c93e5?auto=format&fit=crop&w=1400&q=70"
              alt=""
            />
            <div className="cover-card-shade" />
            <div className="cover-card-body">
              <p className="cover-kicker">奧地利 × 意大利</p>
              <h2>聖誕長線</h2>
              <p>長線範本，適合更改日期或人數</p>
              <div className="cover-meta">
                <span>改日期</span>
                <span>改人數</span>
              </div>
              <div className="cover-actions">
                <button type="button" className="btn btn-primary" onClick={() => loadSample(austriaSample)}>
                  打開
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => void copyText(buildSampleEditPrompt("奧地利 × 意大利聖誕", austriaSample), "austria")}
                >
                  {copied === "austria" ? "已複製" : "複製給 AI"}
                </button>
              </div>
            </div>
          </article>
        </div>
        <p className="import-sample">
          「打開」即可查看行程。「複製給 AI」會連同完整 JSON 一齊複製；貼到 ChatGPT／Gemini 後，下一則訊息輸入你想修改的內容（日期、人數、不想去的地方）。
        </p>
      </header>

      {saved.length > 0 && (
        <section className="saved-trips panel">
          <div className="panel-head">
            <h2>本機已封存</h2>
            <span>尚無後端，暫存於此裝置／瀏覽器中</span>
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
        <summary>自行規劃／貼上 JSON</summary>
        <div className="tweak-row">
          <span className="import-label">用法</span>
          <InfoTip title="如何自行規劃">
            <ol>
              <li>Travier 本身不會呼叫 AI；你需要自行前往外部具備聯網功能的 AI。</li>
              <li>填好下方行程條件 → 點擊「複製計劃」。</li>
              <li>貼到 AI，請其根據規格僅輸出一個完整行程 JSON（不要使用 Markdown）。</li>
              <li>將 JSON 貼回最底部的「貼上 AI JSON」→「匯入行程」。</li>
              <li>後續若需改某一天：前往行程頁切到那天，點「複製當日」（AI 只回傳當天 patch）。</li>
            </ol>
            <p>手上已有行程文字：使用「只複製規格」，再請 AI 轉為 Travier JSON。</p>
          </InfoTip>
        </div>
        <section className="plan-section first">
          <div className="tweak-row">
            <p className="import-label">行程條件</p>
            <InfoTip title="行程條件">
              <p>在此填寫的日期、人數、節奏與目的地，會一併寫入「複製計劃」提供給 AI。</p>
              <p>修改條件後必須重新點擊一次「複製計劃」，請勿使用舊的剪貼簿內容。</p>
              <p>節奏越 packed（緊湊），每日景點會越密集；放鬆則會保留較多步行與休息時間。</p>
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
            <InfoTip title="兩個複製按鈕">
              <p>
                <strong>複製計劃</strong>：你填寫的條件＋完整 JSON 規格。適合從零開始請 AI 規劃。
              </p>
              <p>
                <strong>只複製規格</strong>：僅有規格、沒有條件。適合你已有行程文字／Excel，請 AI 轉成可匯入的 JSON。
              </p>
              <p>兩個按鈕都不會自動呼叫 AI；須由你自行貼到外部的 AI 對話視窗。</p>
            </InfoTip>
          </div>
        </section>
        <section className="plan-section">
          <div className="tweak-row">
            <label className="import-label" htmlFor="trip-json">
              貼上 AI JSON
            </label>
            <InfoTip title="匯入 JSON">
              <p>此欄位只需<strong>完整行程</strong>：至少包含 <code>schemaVersion</code>、<code>trip</code>、<code>days</code>。</p>
              <p>匯入頁面<strong>不接收</strong>微改 patch（<code>1.0.0-patch</code>）。若已有行程只需改某一天，請前往行程頁的「改當日」貼上。</p>
              <p>若匯入失敗：檢查 AI 是否加上了前言或 ``` 符號；必須是純 JSON。常見錯誤為 true/false 後面多出文字，或將連結寫成 Markdown 格式。</p>
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
