import { googleFlightsUrl } from "./links";
import type { Transport } from "../types";

const BOOKING_MODES = new Set(["night_train", "flight"]);
const BOOKING_LINES = /nightjet|frecciarossa|railjet|eurostar|thalys|italo|ice\b|tgv/i;

export function needsBooking(transport: Transport): boolean {
  if (transport.booking?.required) return true;
  if (BOOKING_MODES.has(transport.mode)) return true;
  return Boolean(transport.line && BOOKING_LINES.test(transport.line));
}

export function bookingFallbackUrl(transport: Transport, date?: string | null, adults?: number): string | null {
  if (transport.booking?.url) return transport.booking.url;
  if (transport.mode === "night_train" || /nightjet/i.test(transport.line ?? "")) return "https://www.nightjet.com/";
  if (transport.mode === "flight") {
    return googleFlightsUrl(transport.fromPlaceQuery, transport.toPlaceQuery, date, adults ?? 1);
  }
  if (/frecciarossa|italo|trenitalia/i.test(`${transport.line} ${transport.operator}`)) return "https://www.trenitalia.com/";
  if (/railjet|öbb|oebb/i.test(`${transport.line} ${transport.operator}`)) return "https://www.oebb.at/";
  if (transport.mode === "train") return "https://www.thetrainline.com/";
  return null;
}

export function bookingHow(transport: Transport): string {
  if (transport.booking?.how) return transport.booking.how;
  if (transport.mode === "night_train") return "前往官方網站選擇日期與車次，先預訂臥鋪或 Couchette，再下載電子票。旺季和跨年需提早預訂，現場通常沒位子。";
  if (transport.mode === "flight") return "利用 Google Flights 或航空公司搜尋該日出發、該航線、該人數的經濟艙，確認行李額度後付款出票。不得憑印象填寫舊價錢。";
  if (transport.mode === "train") return "在鐵路官網或 Trainline 選擇該日車次與座位，長途高鐵多數需要先預約。";
  return "先到官方或票務網站選擇日期，確認有位後再付款。";
}

export function bookingWhy(transport: Transport): string {
  if (transport.booking?.why) return transport.booking.why;
  if (transport.mode === "night_train") return "夜火車臥鋪有限，不預約可能只剩無座票或整班售罄，跨年更容易客滿。";
  if (transport.mode === "flight") return "機票數量和價錢隨時變動，不預訂就無法登機。";
  if (transport.mode === "train") return "這類長途或指定車次通常需要對號入座，未預約可能無法上車。";
  return "這段交通可能已客滿或需要對號票。";
}
