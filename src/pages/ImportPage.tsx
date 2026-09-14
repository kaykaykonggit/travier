import { useEffect, useState } from "react";
import { InfoTip } from "../components/InfoTip";
import { PlannerForm } from "../components/PlannerForm";
import { parseTripDoc, parseTripJson } from "../lib/parse";
import { buildPlannerPrompt, loadBrief, saveBrief, type TripBrief } from "../lib/planner";
import { AI_TEMPLATE } from "../lib/template";
import type { TripDoc } from "../types";
import sample from "../../examples/austria-italy-christmas-2026.json";

export function ImportPage({ onImport }: { onImport: (doc: TripDoc) => void }) {
  const [brief, setBrief] = useState<TripBrief>(() => loadBrief());
  const [text, setText] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [copied, setCopied] = useState<"plan" | "spec" | null>(null);

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

  function loadSample() {
    const result = parseTripDoc(sample as unknown);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors([]);
    onImport(result.doc);
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
        <button type="button" className="btn btn-primary btn-block import-go" onClick={loadSample}>
          即刻睇一份真行程
        </button>
        <p className="import-sample">奧地利 × 意大利聖誕範例，撳完就可以行完成程。</p>
      </header>

      <details className="quiet-details plan-later" {...(errors.length > 0 ? { open: true } : {})}>
        <summary className="with-info">
          <span>自己規劃／貼 JSON</span>
          <InfoTip title="點樣自己規劃">
            <ol>
              <li>網站自己唔會叫 AI。</li>
              <li>填條件 →「複製計劃」→ 貼去會搜網嘅 AI。</li>
              <li>AI 只交一份完整行程 JSON，再貼返下面匯入。</li>
              <li>已經有行程：匯入後去行程頁用「微改」（AI 只交細份 patch）。</li>
            </ol>
            <p>若你手上已有行程文字，可「只複製規格」再叫 AI 轉 JSON。</p>
          </InfoTip>
        </summary>
        <section className="plan-section first">
          <div className="tweak-row">
            <p className="import-label">行程條件</p>
            <InfoTip title="行程條件">
              <p>日期、人數、節奏、想去邊會寫入複製俾 AI 嘅計劃。改完條件記得再複製一次。</p>
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
                <strong>複製計劃</strong>：條件＋完整 JSON 規格，適合由零規劃。
              </p>
              <p>
                <strong>只複製規格</strong>：你已有行程文字時用，叫 AI 轉成 Travier JSON。
              </p>
            </InfoTip>
          </div>
        </section>
        <section className="plan-section">
          <div className="tweak-row">
            <label className="import-label" htmlFor="trip-json">
              貼上 AI JSON
            </label>
            <InfoTip title="匯入 JSON">
              <p>貼完整行程（要有 schemaVersion、trip、days）。匯入頁唔收微改 patch；patch 請喺行程頁「微改」貼。</p>
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
