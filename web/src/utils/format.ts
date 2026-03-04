/** Shared date/time/currency formatting utilities for web app */

/** Format time string (HH:MM:SS) to HH:MM, or em-dash if null */
export function fmt(time: string | null): string {
  return time ? time.slice(0, 5) : '\u2014';
}

/** Format fee as £X.XX, or em-dash if null */
export function fmtFee(fee: number | null): string {
  return fee != null ? `\u00A3${fee.toFixed(2)}` : '\u2014';
}

/** Full display date: "Monday, 3 March 2026" */
export function formatDisplayDate(iso: string): string {
  const d = new Date(iso + 'T12:00:00');
  return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

/** Short group date: "Mon, 3 Mar" */
export function formatGroupDate(iso: string): string {
  const d = new Date(iso + 'T12:00:00');
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

/** "Today", "Tomorrow", or "N days" */
export function daysUntil(iso: string): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(iso + 'T00:00:00');
  const diff = Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  return `${diff} days`;
}

/** Date range: "3 Mar – 7 Mar 2026" or single "3 Mar 2026" */
export function formatRange(start: string, end: string): string {
  const s = new Date(start + 'T12:00:00');
  const e = new Date(end + 'T12:00:00');
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
  if (start === end) return s.toLocaleDateString('en-GB', { ...opts, year: 'numeric' });
  return `${s.toLocaleDateString('en-GB', opts)} \u2013 ${e.toLocaleDateString('en-GB', { ...opts, year: 'numeric' })}`;
}

/** Relative time: "just now", "5m ago", "2h ago", "3d ago", or "3 Mar" */
export function formatRelative(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

/** Short date with weekday: "Mon, 3 Mar 2026" */
export function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}
