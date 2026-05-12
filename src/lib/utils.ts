import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format an IPL match date (e.g. "2026-05-13") as the SAME calendar date in IST
 * regardless of the viewer's timezone. Without this, `new Date("2026-05-13")`
 * gets parsed as UTC midnight and US viewers see "May 12".
 */
export function formatMatchDate(
  dateStr: string,
  options: Intl.DateTimeFormatOptions = { weekday: "short", month: "short", day: "numeric" }
): string {
  // Anchor at noon IST — far from any timezone boundary, so the resulting Date
  // is unambiguously "this calendar date in IST" everywhere on Earth.
  const d = new Date(`${dateStr}T12:00:00+05:30`);
  return d.toLocaleDateString("en-US", { ...options, timeZone: "Asia/Kolkata" });
}

/** True if `dateStr` is today's date in IST. */
export function isMatchTodayIST(dateStr: string): boolean {
  const todayIST = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  return dateStr === todayIST;
}

/**
 * True if a match is *likely* live right now — defined as: today in IST, and
 * current IST hour is between 15:00 and 24:00 (covers afternoon + evening slots,
 * with a buffer for late finishes). We don't have real per-match start times.
 */
export function isMatchLikelyLive(dateStr: string): boolean {
  if (!isMatchTodayIST(dateStr)) return false;
  const istHour = parseInt(
    new Date().toLocaleString("en-US", {
      timeZone: "Asia/Kolkata",
      hour: "2-digit",
      hour12: false,
    }),
    10
  );
  return istHour >= 15;
}

/** "5 minutes ago" / "2 hours ago" / "yesterday" — for the "last updated" stamp. */
export function relativeTimeFrom(iso: string, now = new Date()): string {
  const then = new Date(iso);
  const sec = Math.round((now.getTime() - then.getTime()) / 1000);
  if (sec < 60) return "just now";
  const min = Math.round(sec / 60);
  if (min < 60) return `${min} minute${min === 1 ? "" : "s"} ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr} hour${hr === 1 ? "" : "s"} ago`;
  const day = Math.round(hr / 24);
  return `${day} day${day === 1 ? "" : "s"} ago`;
}
