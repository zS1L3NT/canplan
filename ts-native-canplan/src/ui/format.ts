import { useEffect, useState } from 'react';
import { dayKey } from '../canvas/store';

export function useNow(intervalMs = 60_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

const MS_MIN = 60_000;
const MS_HOUR = 3_600_000;
const MS_DAY = 86_400_000;

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function diffDaysFromToday(d: Date, now = new Date()): number {
  const a = startOfDay(now).getTime();
  const b = startOfDay(d).getTime();
  return Math.round((b - a) / MS_DAY);
}

/**
 * Relative timestamp that agrees with calendar-day section headers:
 * "Yesterday" / "Tomorrow" are only emitted when the date's calendar day is literally ±1 day from now.
 */
export function formatRelative(iso: string | null | undefined, nowMs = Date.now()): string {
  if (!iso) return '';
  const d = new Date(iso);
  const ts = d.getTime();
  if (Number.isNaN(ts)) return '';
  const diff = nowMs - ts;
  const abs = Math.abs(diff);

  if (abs < MS_MIN) return 'just now';
  if (abs < MS_HOUR) {
    const mins = Math.round(abs / MS_MIN);
    return diff >= 0 ? `${mins}m ago` : `in ${mins}m`;
  }
  if (abs < MS_DAY) {
    const hrs = Math.round(abs / MS_HOUR);
    return diff >= 0 ? `${hrs}h ago` : `in ${hrs}h`;
  }

  const calDays = diffDaysFromToday(d, new Date(nowMs));
  if (calDays === -1) return 'Yesterday';
  if (calDays === 1) return 'Tomorrow';
  if (calDays < -1 && calDays > -7) return `${Math.abs(calDays)}d ago`;
  if (calDays > 1 && calDays < 7) return `in ${calDays}d`;
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

export function formatRelativeLong(iso: string | null | undefined, nowMs = Date.now()): string {
  if (!iso) return '';
  const d = new Date(iso);
  const ts = d.getTime();
  if (Number.isNaN(ts)) return '';
  const diff = nowMs - ts;
  const abs = Math.abs(diff);

  if (abs < MS_MIN) return 'just now';
  if (abs < MS_HOUR) {
    const mins = Math.round(abs / MS_MIN);
    const unit = mins === 1 ? 'minute' : 'minutes';
    return diff >= 0 ? `${mins} ${unit} ago` : `in ${mins} ${unit}`;
  }
  if (abs < MS_DAY) {
    const hrs = Math.round(abs / MS_HOUR);
    const unit = hrs === 1 ? 'hour' : 'hours';
    return diff >= 0 ? `${hrs} ${unit} ago` : `in ${hrs} ${unit}`;
  }

  const calDays = diffDaysFromToday(d, new Date(nowMs));
  if (calDays === -1) return 'yesterday';
  if (calDays === 1) return 'tomorrow';
  if (calDays < -1 && calDays > -7) return `${Math.abs(calDays)} days ago`;
  if (calDays > 1 && calDays < 7) return `in ${calDays} days`;
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

export function formatDayHeading(isoOrDayKey: string, nowMs = Date.now()): string {
  const d = isoOrDayKey.length === 10 ? parseDayKey(isoOrDayKey) : new Date(isoOrDayKey);
  if (!d || Number.isNaN(d.getTime())) return isoOrDayKey;
  const days = diffDaysFromToday(d, new Date(nowMs));
  const full = d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' });
  if (days === 0) return `Today · ${d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`;
  if (days === -1) return `Yesterday · ${d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`;
  if (days === 1) return `Tomorrow · ${d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`;
  return full;
}

export function formatDueText(iso: string | null | undefined, nowMs = Date.now()): string {
  if (!iso) return 'No deadline';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'No deadline';
  const time = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  const days = diffDaysFromToday(d, new Date(nowMs));

  if (d.getTime() < nowMs) {
    if (days === 0) return `Overdue · Today ${time}`;
    const short = d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
    return `Overdue · ${short}, ${time}`;
  }
  if (days === 0) return `Due today, ${time}`;
  if (days === 1) return `Due tomorrow, ${time}`;
  const weekdayDate = d.toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
  return `Due ${weekdayDate}`;
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return 'None';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'None';
  return d.toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatShortDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

/** Compact time like "1 PM" or "11:59 PM", omitting ":00" minutes when on the hour. */
export function formatCompactTime(d: Date): string {
  const h = d.getHours();
  const m = d.getMinutes();
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${h12} ${period}` : `${h12}:${String(m).padStart(2, '0')} ${period}`;
}

/**
 * Compact date for right-aligned line 1 (e.g. "29 Nov", "Today", "Today 1 PM").
 * Never emits "Overdue" — color/glyph conveys overdue status.
 */
export function formatCompactDate(
  iso: string | null | undefined,
  nowMs = Date.now(),
  options?: { inTodaySection?: boolean; includeTodayTime?: boolean },
): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const days = diffDaysFromToday(d, new Date(nowMs));
  const isEndOfDay = d.getHours() === 23 && d.getMinutes() >= 55;
  if (days === 0) {
    if (options?.inTodaySection) {
      return isEndOfDay ? '' : formatCompactTime(d);
    }
    if (options?.includeTodayTime && !isEndOfDay) {
      return `Today ${formatCompactTime(d)}`;
    }
    return 'Today';
  }
  if (days === 1) return 'Tomorrow';
  return `${d.getDate()} ${SHORT_MONTHS[d.getMonth()]}`;
}

/**
 * Inline due text for line 2 (e.g. "Due 29 Nov", "Due today", "Due today 1 PM").
 * Never emits "Overdue" on done rows, and omits "Today" when inside the Today section.
 */
export function formatInlineDue(
  iso: string | null | undefined,
  nowMs = Date.now(),
  options?: { done?: boolean; inTodaySection?: boolean; includeTodayTime?: boolean },
): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const days = diffDaysFromToday(d, new Date(nowMs));
  const isEndOfDay = d.getHours() === 23 && d.getMinutes() >= 55;
  const short = `${d.getDate()} ${SHORT_MONTHS[d.getMonth()]}`;

  if (options?.done) {
    return short;
  }
  if (days === 0) {
    if (options?.inTodaySection) {
      return isEndOfDay ? '' : `Due ${formatCompactTime(d)}`;
    }
    if (options?.includeTodayTime && !isEndOfDay) {
      return `Due today ${formatCompactTime(d)}`;
    }
    return 'Due today';
  }
  if (days === 1) return 'Due tomorrow';
  return `Due ${short}`;
}

/**
 * Strips the course code and bracketed term tag (e.g. "[2610]") from a Canvas course name.
 */
export function cleanCourseName(code: string, name?: string | null): string {
  if (!name) return '';
  let out = name.trim();
  // Strip bracketed term codes like [2610], [2520], [AY25/26]
  out = out.replace(/\s*\[[^\]]+\]\s*/g, ' ').trim();
  // Strip leading course code (case-insensitive) plus optional separator (: - – —)
  const escapedCode = code.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (escapedCode) {
    const leadingRe = new RegExp(`^${escapedCode}(?:\\s*[:\\-–—]\\s*|\\s+)`, 'i');
    out = out.replace(leadingRe, '').trim();
    if (out.toLowerCase() === code.trim().toLowerCase()) return '';
  }
  return out.replace(/\s{2,}/g, ' ').trim();
}

const SHORT_WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const SHORT_MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
] as const;

/** Formats a YYYY-MM-DD day key as "Sun 22 Nov". */
export function formatShortWeekdayDate(dayKeyStr: string): string {
  const d = parseDayKey(dayKeyStr);
  if (!d) return dayKeyStr;
  return `${SHORT_WEEKDAYS[d.getDay()]} ${d.getDate()} ${SHORT_MONTHS[d.getMonth()]}`;
}

/** Formats an ISO timestamp as "Wed 25 Nov". */
export function formatWeekdayDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${SHORT_WEEKDAYS[d.getDay()]} ${d.getDate()} ${SHORT_MONTHS[d.getMonth()]}`;
}

/** Formats Canvas point totals cleanly without noisy trailing decimals (e.g. 20, 14.5, 18.75). */
export function formatPoints(value: number): string {
  if (!Number.isFinite(value)) return '0';
  const rounded = Math.round(value * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded);
}

export function formatBytes(bytes?: number): string {
  if (!bytes || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function parseDayKey(key: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const day = Number(m[3]);
  const d = new Date(y, mo, day);
  if (d.getFullYear() !== y || d.getMonth() !== mo || d.getDate() !== day) return null;
  return d;
}

export function isoFromDayKey(key: string, hour = 23, minute = 59): string | null {
  const d = parseDayKey(key);
  if (!d) return null;
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

export function nextNDays(count = 7, from = new Date()): { key: string; label: string; shortLabel: string }[] {
  const base = startOfDay(from);
  const out: { key: string; label: string; shortLabel: string }[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(base.getTime() + i * MS_DAY);
    const key = dayKey(d);
    const shortLabel =
      i === 0
        ? 'Today'
        : i === 1
          ? 'Tmrw'
          : d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' });
    const label =
      i === 0
        ? 'Today'
        : i === 1
          ? 'Tomorrow'
          : d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
    out.push({ key, label, shortLabel });
  }
  return out;
}

const HIGHLIGHT_STOPWORDS = new Set([
  'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'to', 'of', 'in', 'on', 'at', 'for', 'and', 'or',
  'what', 'where', 'when', 'which', 'who', 'how', 'why', 'do', 'does', 'did', 'can', 'could', 'i', 'my',
  'me', 'we', 'it', 'its', 'this', 'that', 'there', 'about', 'with', 'any', 'allowed', 'even',
]);

export function extractQueryTerms(query: string): string[] {
  const words = query
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((t) => t.length > 1);
  const content = words.filter((t) => !HIGHLIGHT_STOPWORDS.has(t));
  return content.length ? content : words;
}

export function splitHighlight(text: string, terms: string[]): { text: string; match: boolean }[] {
  if (!text || terms.length === 0) return [{ text, match: false }];
  const escaped = terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const re = new RegExp(`(${escaped.join('|')})`, 'gi');
  const parts = text.split(re);
  const out: { text: string; match: boolean }[] = [];
  for (const part of parts) {
    if (!part) continue;
    const isMatch = terms.some((t) => part.toLowerCase() === t);
    out.push({ text: part, match: isMatch });
  }
  return out;
}

/**
 * Converts Canvas HTML into readable plain text while preserving paragraph breaks,
 * line breaks, and bullet lists. Zero extra dependencies.
 */
export function htmlToReadableText(html?: string | null): string {
  if (!html) return '';
  const decoded = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<hr\s*\/?>/gi, '\n\n---\n\n')
    .replace(/<li[^>]*>/gi, '\n• ')
    .replace(/<\/li>/gi, '\n')
    .replace(/<\/(p|div|h[1-6]|tr|blockquote|pre|ul|ol|table)>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&mdash;/gi, '—')
    .replace(/&ndash;/gi, '–')
    .replace(/&hellip;/gi, '…')
    .replace(/&rsquo;|&lsquo;/gi, "'")
    .replace(/&rdquo;|&ldquo;/gi, '"')
    .replace(/&bull;/gi, '•')
    .replace(/&#(\d+);/g, (_, code) => {
      const n = Number(code);
      return Number.isFinite(n) ? String.fromCodePoint(n) : '';
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => {
      const n = parseInt(hex, 16);
      return Number.isFinite(n) ? String.fromCodePoint(n) : '';
    });

  return decoded
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
