import { AI_TEMPLATE } from "./template";

export type TripBrief = {
  destinations: string;
  startDate: string;
  endDate: string;
  origin: string;
  departurePoint: string;
  returnPoint: string;
  adults: string;
  children: string;
  sightsPerDay: string;
  transport: string;
  pace: string;
  hotelBudget: string;
  hotelCurrency: string;
  hotelStyle: string;
  mealBudget: string;
  mustSee: string;
  avoid: string;
  interests: string;
  nightTrain: string;
  earliestStart: string;
  notes: string;
};

export const EMPTY_BRIEF: TripBrief = {
  destinations: "",
  startDate: "",
  endDate: "",
  origin: "香港",
  departurePoint: "",
  returnPoint: "",
  adults: "2",
  children: "0",
  sightsPerDay: "3",
  transport: "transit",
  pace: "normal",
  hotelBudget: "",
  hotelCurrency: "EUR",
  hotelStyle: "mid",
  mealBudget: "",
  mustSee: "",
  avoid: "",
  interests: "",
  nightTrain: "ok",
  earliestStart: "",
  notes: "",
};

const TRANSPORT_LABEL: Record<string, string> = {
  transit: "公共交通為主（地鐵、火車、步行）",
  drive: "自駕為主",
  mix: "公共交通與自駕混合",
};

const PACE_LABEL: Record<string, string> = {
  relaxed: "休閒，留白多、不趕路",
  normal: "一般",
  packed: "緊湊，景點排滿",
};

const HOTEL_STYLE_LABEL: Record<string, string> = {
  any: "不限",
  budget: "經濟型",
  mid: "中價舒適",
  boutique: "精品／設計酒店",
};

const NIGHT_TRAIN_LABEL: Record<string, string> = {
  ok: "可以坐夜火車",
  no: "不要夜火車",
  prefer: "希望安排一晚夜火車",
};

const SIGHTS_LABEL: Record<string, string> = {
  "2": "約 2 個主要停留（含用餐以外）",
  "3": "約 3 個主要停留",
  "4": "約 4 個主要停留",
  "5": "約 5 個，偏趕",
  any: "不限，按節奏決定",
};

function line(label: string, value: string, fallback = "未填，由你合理安排"): string {
  const text = value.trim();
  return `${label}：${text || fallback}`;
}

export function formatBrief(brief: TripBrief): string {
  const hotel =
    brief.hotelBudget.trim()
      ? `每晚一房約 ${brief.hotelBudget.trim()} ${brief.hotelCurrency}（${HOTEL_STYLE_LABEL[brief.hotelStyle] ?? brief.hotelStyle}）`
      : `未填預算；風格 ${HOTEL_STYLE_LABEL[brief.hotelStyle] ?? brief.hotelStyle}，由你按休息點選參考酒店`;
  const meal = brief.mealBudget.trim()
    ? `每人每日約 ${brief.mealBudget.trim()} ${brief.hotelCurrency}`
    : "未填；熱門區午餐晚餐要寫具體可訂餐廳，不要只估價錢";

  return [
    line("想去的地方（建議順路順序）", brief.destinations),
    line("出發日", brief.startDate),
    line("回程日", brief.endDate),
    line("常住／出發城市", brief.origin),
    line("出發點（機場／車站）", brief.departurePoint || brief.origin),
    line("回程點（機場／車站）", brief.returnPoint || "與出發點相同"),
    line("大人", brief.adults || "2"),
    line("小孩", brief.children || "0"),
    line("每日平均主要景點數", SIGHTS_LABEL[brief.sightsPerDay] ?? brief.sightsPerDay),
    line("交通方式", TRANSPORT_LABEL[brief.transport] ?? brief.transport),
    line("節奏", PACE_LABEL[brief.pace] ?? brief.pace),
    `酒店預算：${hotel}`,
    `餐飲預算：${meal}`,
    line("必去／必看", brief.mustSee),
    line("不要／想避開", brief.avoid),
    line("興趣（美食、藝術、自然、購物、音樂會等）", brief.interests),
    line("夜火車", NIGHT_TRAIN_LABEL[brief.nightTrain] ?? brief.nightTrain),
    line("當天最早可出門時間", brief.earliestStart),
    line("其他備註", brief.notes),
  ].join("\n");
}

export function buildPlannerPrompt(brief: TripBrief): string {
  return `你是旅行規劃師，也是行程資料轉換器。先按「用戶條件」規劃一份完整、可執行的行程（每日動線、休息區、交通、門票），再用網頁搜尋查該出發日／入住日的現價，最後只輸出一份符合下方規格的 JSON。

硬性補充：
- 空着的條件表示沒有限制，由你合理安排，不要追問用戶。
- 每日主要停留數量按條件控制，不要把一天塞爆。
- 酒店按「今日行程結束點」與明早出發點選區，預算是一房一晚，不要乘人數。
- 同一帶除午餐外，有長逗留就加可訂的下午茶或晚餐，熱門餐廳要有訂位網址。日本用 Tabelog／ホットペッパー，歐洲用 TheFork／OpenTable。
- 出發點與回程點要寫進第一天與最後一天的機票或火車。
- 只輸出一個 JSON 物件。不要 Markdown、不要前言。

===== 用戶條件 =====
${formatBrief(brief)}

===== JSON 規格（必須完全遵守）=====
${AI_TEMPLATE}

現在根據用戶條件規劃、搜尋該日現價，然後只輸出 JSON。`;
}

const BRIEF_KEY = "travier.brief.v1";

export function loadBrief(): TripBrief {
  try {
    const raw = localStorage.getItem(BRIEF_KEY);
    if (!raw) return { ...EMPTY_BRIEF };
    const parsed = JSON.parse(raw) as Partial<TripBrief>;
    return { ...EMPTY_BRIEF, ...parsed };
  } catch {
    return { ...EMPTY_BRIEF };
  }
}

export function saveBrief(brief: TripBrief): void {
  localStorage.setItem(BRIEF_KEY, JSON.stringify(brief));
}
