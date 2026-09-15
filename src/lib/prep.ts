import type { PrepItem, PrepSection, TripDoc } from "../types";

export type { PrepItem, PrepSection } from "../types";

export const PREP_SECTIONS: { id: PrepSection; label: string; hint: string; addLabel: string }[] = [
  { id: "him_pack", label: "男友行李", hint: "設備／藥品／文件", addLabel: "新增男友行李" },
  { id: "him_todo", label: "待辦", hint: "出發前要做", addLabel: "新增待辦" },
  { id: "her_pack", label: "女友行李", hint: "衣物／護理／證件", addLabel: "新增女友行李" },
];

function newId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

type SeedRow = { section: PrepSection; group: string; title: string };

/** Default packing + todo list (Okinawa Sep summer / couple self-drive). */
const SEED: SeedRow[] = [
  // 男朋友要帶
  { section: "him_pack", group: "拍攝與電子設備", title: "大容量尿袋（戶外拍片、開地圖極耗電）" },
  { section: "him_pack", group: "拍攝與電子設備", title: "Pocket 3 專用配件（充電線、自拍棍／小型三腳架）" },
  { section: "him_pack", group: "拍攝與電子設備", title: "萬能插頭（日本兩腳扁插）" },
  { section: "him_pack", group: "拍攝與電子設備", title: "車用雙位 USB 充電器（車充）" },
  { section: "him_pack", group: "拍攝與電子設備", title: "手機磁吸支架／導航夾（自駕導航用）" },
  { section: "him_pack", group: "拍攝與電子設備", title: "太陽眼鏡（司機防眩光用）" },

  { section: "him_pack", group: "共用藥品與戶外急救", title: "防蚊蟲叮咬藥膏／蚊怕水" },
  { section: "him_pack", group: "共用藥品與戶外急救", title: "暈浪丸（水上活動／離島）" },
  {
    section: "him_pack",
    group: "共用藥品與戶外急救",
    title: "常備藥（胃藥、必理痛、消炎止痛、收鼻水、M痛藥、濕疹藥膏、保濟丸、膠布、維他命C）",
  },

  { section: "him_pack", group: "防曬與雨具", title: "大支裝高防曬 SPF50+ PA++++（兩人共用）" },
  { section: "him_pack", group: "防曬與雨具", title: "大雨傘／輕便雨衣（9月驟雨）" },

  { section: "him_pack", group: "代印文件（A4 文件袋）", title: "租車預約確認信（編號、分店地址電話）" },
  { section: "him_pack", group: "代印文件（A4 文件袋）", title: "航班機票憑證（E-ticket）" },
  { section: "him_pack", group: "代印文件（A4 文件袋）", title: "酒店預訂確認信" },
  { section: "him_pack", group: "代印文件（A4 文件袋）", title: "行程大綱、景點電話及 Mapcode 列表" },
  { section: "him_pack", group: "代印文件（A4 文件袋）", title: "旅遊保險單及 24 小時緊急支援電話" },
  { section: "him_pack", group: "代印文件（A4 文件袋）", title: "Visit Japan Web QR Code 截圖列印本" },

  // 男朋友要做
  { section: "him_todo", group: "出發前", title: "辦理香港駕駛執照及國際駕駛許可證（國際牌）正本帶齊" },
  { section: "him_todo", group: "出發前", title: "整理並打印所有旅遊與自駕文件" },
  { section: "him_todo", group: "出發前", title: "準備少量日圓散銀硬幣（停車場／自動販賣機）" },
  { section: "him_todo", group: "出發前", title: "出發前網上 Check-in" },

  // 女朋友要帶
  { section: "her_pack", group: "電子", title: "iPhone 叉電線" },
  { section: "her_pack", group: "電子", title: "直髮夾" },
  { section: "her_pack", group: "電子", title: "Pocket 3（若由她保管）" },
  { section: "her_pack", group: "電子", title: "電話繩（掛頸防跌落水）" },

  { section: "her_pack", group: "衣物", title: "上衣 × 5（透氣、快乾、度假風）" },
  { section: "her_pack", group: "衣物", title: "下身 × 3（短褲、輕便裙裝）" },
  { section: "her_pack", group: "衣物", title: "薄防曬外套／薄恤衫 × 1" },
  { section: "her_pack", group: "衣物", title: "睡衣 1 set" },
  { section: "her_pack", group: "衣物", title: "Bra × 5" },
  { section: "her_pack", group: "衣物", title: "一次性內褲 × 10" },
  { section: "her_pack", group: "衣物", title: "一次性襪" },
  { section: "her_pack", group: "衣物", title: "毛巾仔" },
  { section: "her_pack", group: "衣物", title: "細袋（街上隨身包）" },
  { section: "her_pack", group: "衣物", title: "Handcarry 袋（背囊或隨身大袋）" },

  { section: "her_pack", group: "個人護理", title: "洗面" },
  { section: "her_pack", group: "個人護理", title: "爽膚水" },
  { section: "her_pack", group: "個人護理", title: "卸妝" },
  { section: "her_pack", group: "個人護理", title: "防曬" },
  { section: "her_pack", group: "個人護理", title: "Body lotion" },
  { section: "her_pack", group: "個人護理", title: "Eye cream" },
  { section: "her_pack", group: "個人護理", title: "護髮素" },
  { section: "her_pack", group: "個人護理", title: "髮尾油" },
  { section: "her_pack", group: "個人護理", title: "Masks" },
  { section: "her_pack", group: "個人護理", title: "蘆薈膠／曬後修護啫喱" },
  { section: "her_pack", group: "個人護理", title: "手提風扇" },
  { section: "her_pack", group: "個人護理", title: "太陽眼鏡／太陽帽" },
  { section: "her_pack", group: "個人護理", title: "腳貼" },
  { section: "her_pack", group: "個人護理", title: "化妝品" },
  { section: "her_pack", group: "個人護理", title: "眼睫毛" },
  { section: "her_pack", group: "個人護理", title: "耳環" },
  { section: "her_pack", group: "個人護理", title: "頸鏈" },
  { section: "her_pack", group: "個人護理", title: "橡皮筋" },
  { section: "her_pack", group: "個人護理", title: "梳" },
  { section: "her_pack", group: "個人護理", title: "牙刷" },
  { section: "her_pack", group: "個人護理", title: "牙膏" },
  { section: "her_pack", group: "個人護理", title: "濕廁紙" },
  { section: "her_pack", group: "個人護理", title: "M巾" },
  { section: "her_pack", group: "個人護理", title: "口罩" },

  { section: "her_pack", group: "其他", title: "HKID（香港身份證）" },
  { section: "her_pack", group: "其他", title: "Passport（護照）" },
  { section: "her_pack", group: "其他", title: "數據卡" },
  { section: "her_pack", group: "其他", title: "日元現金" },
  { section: "her_pack", group: "其他", title: "頸枕（航程休息）" },
  { section: "her_pack", group: "其他", title: "膠袋／垃圾袋 2–3 個（裝濕衣）" },
  { section: "her_pack", group: "其他", title: "紙巾" },
  { section: "her_pack", group: "其他", title: "Online Check-in" },
];

export function defaultPrepItems(): PrepItem[] {
  return SEED.map((row, index) => ({
    id: `prep-seed-${index + 1}`,
    section: row.section,
    group: row.group,
    title: row.title,
    done: false,
  }));
}

/** Seed default checklist once when trip has no prep field yet. */
export function ensurePrep(doc: TripDoc): TripDoc {
  if (doc.prep != null) return doc;
  return { ...doc, prep: defaultPrepItems() };
}

export function togglePrepDone(doc: TripDoc, id: string): TripDoc {
  const prep = (doc.prep ?? []).map((item) => (item.id === id ? { ...item, done: !item.done } : item));
  return { ...doc, prep };
}

export function deletePrepItem(doc: TripDoc, id: string): TripDoc {
  return { ...doc, prep: (doc.prep ?? []).filter((item) => item.id !== id) };
}

export function addPrepItem(
  doc: TripDoc,
  input: { section: PrepSection; group?: string; title: string },
): TripDoc {
  const title = input.title.trim();
  if (!title) return doc;
  const item: PrepItem = {
    id: newId("prep"),
    section: input.section,
    group: (input.group ?? "").trim(),
    title,
    done: false,
  };
  return { ...doc, prep: [item, ...(doc.prep ?? [])] };
}

export function updatePrepItem(
  doc: TripDoc,
  id: string,
  patch: Partial<Pick<PrepItem, "title" | "group" | "section" | "done">>,
): TripDoc {
  const prep = (doc.prep ?? []).map((item) => {
    if (item.id !== id) return item;
    return {
      ...item,
      title: patch.title != null ? patch.title.trim() || item.title : item.title,
      group: patch.group != null ? patch.group.trim() : item.group,
      section: patch.section ?? item.section,
      done: patch.done ?? item.done,
    };
  });
  return { ...doc, prep };
}

export function prepProgress(items: PrepItem[]): { done: number; total: number } {
  const total = items.length;
  const done = items.filter((item) => item.done).length;
  return { done, total };
}
