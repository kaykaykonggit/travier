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
  if (transport.mode === "night_train") return "上官方網站選日期與車次，先訂臥鋪或 Couchette，再下載電子票。旺季和跨年要提早訂，現場常沒位。";
  if (transport.mode === "flight") return "用 Google Flights 或航空公司搜該日出發、該航線、該人數的經濟艙，確認行李額後付款出票。不准憑印象填舊價錢。";
  if (transport.mode === "train") return "在鐵路官網或 Trainline 選該日車次與座位，長途高鐵多數要先預約。";
  return "先到官方或票務網站選日期，確認有位再付款。";
}

export function bookingWhy(transport: Transport): string {
  if (transport.booking?.why) return transport.booking.why;
  if (transport.mode === "night_train") return "夜火車臥鋪有限，不預約可能只剩無座或整班賣完，跨年更易滿。";
  if (transport.mode === "flight") return "機票數量和價錢隨時變，不定位就不能登機。";
  if (transport.mode === "train") return "這類長途或指定車次通常要對號入座，未預約可能無法上車。";
  return "這段交通可能額滿或需要對號票。";
}
