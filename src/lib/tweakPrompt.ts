import { PATCH_TEMPLATE } from "./patchTemplate";
import { doneKey } from "./progress";
import { firstSightOfDay, lastSightOfDay } from "./restPoint";
import type { Day, Night, TimelineItem, TripDoc } from "../types";

const SKIP_VISIT = new Set(["transit", "flight", "hotel", "rest", "night_train"]);

function itemLabel(date: string, start: string, name: string, query: string): string {
  return `- ${date} ${start} · ${name}${query ? ` · ${query}` : ""}`;
}

function stopHint(item: TimelineItem | null): string | null {
  if (!item) return null;
  const name = item.displayNameZh || item.title;
  return `${item.start} · ${name}${item.placeQuery.trim() ? ` · ${item.placeQuery.trim()}` : ""}`;
}

function neighborContext(doc: TripDoc, viewingDate: string) {
  const index = doc.days.findIndex((day) => day.date === viewingDate);
  const prev = index > 0 ? doc.days[index - 1] : undefined;
  const next = index >= 0 && index < doc.days.length - 1 ? doc.days[index + 1] : undefined;
  return {
    previousEvening: prev
      ? { date: prev.date, lastStop: stopHint(lastSightOfDay(prev)), stayCity: prev.stayCity }
      : null,
    nextMorning: next
      ? { date: next.date, firstStop: stopHint(firstSightOfDay(next)), stayCity: next.stayCity }
      : null,
  };
}

function slimDayContext(doc: TripDoc, viewingDate: string) {
  const day = doc.days.find((item) => item.date === viewingDate);
  const nights: Night[] = doc.nights.filter((night) => night.date === viewingDate);
  const klook = doc.klook.filter((item) => item.date === viewingDate);
  const days: Day[] = day ? [day] : [];
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
    neighbors: neighborContext(doc, viewingDate),
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
      if (day.date !== viewingDate) return;
      if (item.locked) keepLocked.push(line);
      else canChange.push(line);
    });
  }

  const hotels = doc.nights
    .filter((night) => night.date === viewingDate && (night.chosenName ?? "").trim())
    .map((night) => `- ${night.date} · 已選 ${night.chosenName}（${night.city}）`);

  const wishText = wish.trim()
    ? wish.trim()
    : "用戶未寫想改咩。只准改呢日明顯錯嘅交通／重複景點／趕到唔合理嘅時段。其他幾乎原樣，可以交空 days/nights/klook。";

  const context = slimDayContext(doc, viewingDate);

  return `你係行程資料微調器。用戶已經 import 咗成份行程，而家只要改 ${viewingDate} 呢一日。唔好由零再規劃，唔好改其他日子。

硬性規則：
1. 只輸出一個 JSON patch（schemaVersion "1.0.0-patch"）。唔好 Markdown、唔好前言。
2. days / nights / klook 只可以包含 date = ${viewingDate}。其他日子一個都唔准交，亦唔准交完整行程。
3. 交 day 就要交齊嗰日完整 timeline（含 transport、ticket、backups）。冇改當晚酒店就 nights: []。冇改門票就 klook: []。
4. 「已去過」名單入面嘅 placeQuery，正選同 backups 都唔准再出現。
5. locked=true 嘅項目，連時間、交通、門票都要原樣保留，除非用戶喺「想怎麼改」明確點名要改。
6. 用戶已選酒店（chosenName）要保留。
7. 只可以改 locked=false、未去過、或者用戶點名要改嘅時段。改完要接得返前後銜接同當晚休息點。
8. 輸出前用網頁搜尋核對你改過嗰啲嘅該日現價。冇改過嘅價錢可以沿用。
9. 「前後銜接」只係參考，唔好輸出嗰兩日。

===== 想怎麼改 =====
${wishText}

===== 已去過，不准再排 =====
${visited.length ? visited.join("\n") : "（未有打勾已去過）"}

===== 呢日要原樣保留（locked）=====
${keepLocked.length ? keepLocked.join("\n") : "（冇鎖住嘅站）"}

===== 呢日可以微改（已解鎖）=====
${canChange.length ? canChange.join("\n") : "（冇解鎖嘅站；冇點名就唔好大翻）"}

===== 呢晚已選酒店，要保留 =====
${hotels.length ? hotels.join("\n") : "（未選酒店）"}

===== 當日行程（只呢日）=====
${JSON.stringify(context)}

===== patch 規格（必須完全遵守）=====
${PATCH_TEMPLATE}

而家只改 ${viewingDate}，搜你改過嘅現價，然後只輸出呢日嘅 patch JSON。`;
}
