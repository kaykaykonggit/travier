import { PATCH_TEMPLATE } from "./patchTemplate";
import { doneKey } from "./progress";
import type { Day, Night, TripDoc } from "../types";

const SKIP_VISIT = new Set(["transit", "flight", "hotel", "rest", "night_train"]);

function itemLabel(date: string, start: string, name: string, query: string): string {
  return `- ${date} ${start} · ${name}${query ? ` · ${query}` : ""}`;
}

function datesNeeded(doc: TripDoc, viewingDate: string): Set<string> {
  const dates = new Set<string>([viewingDate]);
  const index = doc.days.findIndex((day) => day.date === viewingDate);
  if (index > 0) dates.add(doc.days[index - 1].date);
  if (index >= 0 && index < doc.days.length - 1) dates.add(doc.days[index + 1].date);

  for (const day of doc.days) {
    if (day.timeline.some((item) => !item.locked)) dates.add(day.date);
  }
  return dates;
}

function slimDay(day: Day): Day {
  return day;
}

function slimContext(doc: TripDoc, viewingDate: string) {
  const dates = datesNeeded(doc, viewingDate);
  const days = doc.days.filter((day) => dates.has(day.date)).map(slimDay);
  const nights: Night[] = doc.nights.filter((night) => dates.has(night.date));
  const klook = doc.klook.filter((item) => dates.has(item.date));
  return {
    schemaVersion: doc.schemaVersion,
    trip: {
      title: doc.trip.title,
      startDate: doc.trip.startDate,
      endDate: doc.trip.endDate,
      travelers: doc.trip.travelers,
      currencies: doc.trip.currencies,
      pace: doc.trip.pace,
    },
    focusDate: viewingDate,
    days,
    nights,
    klook,
  };
}

export function buildTweakPrompt(doc: TripDoc, done: Set<string>, wish: string, viewingDate: string): string {
  const visited: string[] = [];
  const keepLocked: string[] = [];
  const canChange: string[] = [];

  for (const day of doc.days) {
    day.timeline.forEach((item, index) => {
      const name = item.displayNameZh || item.title;
      const line = itemLabel(day.date, item.start, name, item.placeQuery.trim());
      if (done.has(doneKey(day.date, index, item.start))) {
        if (!SKIP_VISIT.has(item.type) && item.placeQuery.trim()) visited.push(line);
      }
      if (item.locked) keepLocked.push(line);
      else canChange.push(line);
    });
  }

  const hotels = doc.nights
    .filter((night) => (night.chosenName ?? "").trim())
    .map((night) => `- ${night.date} · 已選 ${night.chosenName}（${night.city}）`);

  const wishText = wish.trim()
    ? wish.trim()
    : "用戶未寫想改咩。只准改明顯錯嘅交通／重複景點／趕到唔合理嘅時段。其他幾乎原樣，可以交空 days/nights/klook。";

  const context = slimContext(doc, viewingDate);

  return `你係行程資料微調器，而家要微調一份已經存在、準備 import 去 Travier 嘅行程。唔好由零再規劃。

硬性規則：
1. 只輸出一個 JSON patch（schemaVersion "1.0.0-patch"）。唔好 Markdown、唔好前言。
2. 只交有改過嘅 days / nights / klook。唔准交完整行程。
3. 「已去過」名單入面嘅 placeQuery，正選同 backups 都唔准再出現。
4. locked=true 嘅項目，連時間、交通、門票都要原樣保留，除非用戶喺「我想點改」明確點名要改。
5. 用戶已選酒店（chosenName）要保留。
6. 只可以改 locked=false、未去過、或者用戶點名要改嘅時段。改完要接得返前後景點同當晚休息點。
7. 輸出前用網頁搜尋核對你改過嗰啲嘅該日現價。冇改過嘅價錢可以沿用。
8. 用戶而家睇緊 ${viewingDate} 呢日，若佢冇講改邊日，優先理解同呢日有關。
9. 下面「行程摘錄」只係相關日子，唔係全日行程；唔好發明摘錄以外嘅新日期。

===== 我想點改 =====
${wishText}

===== 已去過，不准再排 =====
${visited.length ? visited.join("\n") : "（未有打勾已去過）"}

===== 要原樣保留（locked）=====
${keepLocked.length ? keepLocked.join("\n") : "（冇鎖住嘅站）"}

===== 可以微改（已解鎖）=====
${canChange.length ? canChange.join("\n") : "（冇解鎖嘅站；冇點名就唔好大翻）"}

===== 已選酒店，要保留 =====
${hotels.length ? hotels.join("\n") : "（未選酒店）"}

===== 行程摘錄（相關日）=====
${JSON.stringify(context)}

===== patch 規格（必須完全遵守）=====
${PATCH_TEMPLATE}

而家按「我想點改」微調，搜你改過嘅現價，然後只輸出 patch JSON。`;
}
