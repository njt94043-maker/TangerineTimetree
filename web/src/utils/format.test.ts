import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  fmt, fmtFee, formatDisplayDate, formatGroupDate, daysUntil,
  formatRange, formatRelative, formatShortDate, formatDateLong,
  formatGBP, todayISO, addDaysISO,
} from './format';

describe('fmt (time formatting)', () => {
  it('returns em-dash for null', () => {
    expect(fmt(null)).toBe('\u2014');
  });

  it('returns em-dash for empty string', () => {
    expect(fmt('')).toBe('\u2014');
  });

  it('formats morning time', () => {
    expect(fmt('09:30:00')).toBe('9:30am');
  });

  it('formats afternoon time', () => {
    expect(fmt('14:00:00')).toBe('2:00pm');
  });

  it('formats noon as 12pm', () => {
    expect(fmt('12:00:00')).toBe('12:00pm');
  });

  it('formats midnight as 12am', () => {
    expect(fmt('00:00:00')).toBe('12:00am');
  });

  it('handles HH:MM without seconds', () => {
    expect(fmt('21:45')).toBe('9:45pm');
  });
});

describe('fmtFee', () => {
  it('returns em-dash for null', () => {
    expect(fmtFee(null)).toBe('\u2014');
  });

  it('formats whole number with decimals', () => {
    expect(fmtFee(100)).toBe('\u00A3100.00');
  });

  it('formats decimal fee', () => {
    expect(fmtFee(250.5)).toBe('\u00A3250.50');
  });

  it('formats zero', () => {
    expect(fmtFee(0)).toBe('\u00A30.00');
  });
});

describe('formatDisplayDate', () => {
  it('formats ISO date to full UK display', () => {
    const result = formatDisplayDate('2026-03-31');
    expect(result).toContain('31');
    expect(result).toContain('March');
    expect(result).toContain('2026');
    expect(result).toContain('Tuesday');
  });
});

describe('formatGroupDate', () => {
  it('formats to short weekday + day + short month', () => {
    const result = formatGroupDate('2026-03-31');
    expect(result).toContain('Tue');
    expect(result).toContain('31');
    expect(result).toContain('Mar');
  });
});

describe('daysUntil', () => {
  afterEach(() => { vi.useRealTimers(); });

  it('returns "Today" for today', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-31T10:00:00'));
    expect(daysUntil('2026-03-31')).toBe('Today');
  });

  it('returns "Tomorrow" for next day', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-31T10:00:00'));
    expect(daysUntil('2026-04-01')).toBe('Tomorrow');
  });

  it('returns "N days" for future dates', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-31T10:00:00'));
    expect(daysUntil('2026-04-05')).toBe('5 days');
  });
});

describe('formatRange', () => {
  it('formats single-day range', () => {
    const result = formatRange('2026-03-31', '2026-03-31');
    expect(result).toContain('31');
    expect(result).toContain('Mar');
    expect(result).toContain('2026');
  });

  it('formats multi-day range with en-dash', () => {
    const result = formatRange('2026-03-28', '2026-03-31');
    expect(result).toContain('28');
    expect(result).toContain('31');
    expect(result).toContain('\u2013'); // en-dash
  });
});

describe('formatRelative', () => {
  afterEach(() => { vi.useRealTimers(); });

  it('returns "just now" for recent timestamps', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-31T10:00:30'));
    expect(formatRelative('2026-03-31T10:00:00')).toBe('just now');
  });

  it('returns minutes ago', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-31T10:05:00'));
    expect(formatRelative('2026-03-31T10:00:00')).toBe('5m ago');
  });

  it('returns hours ago', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-31T13:00:00'));
    expect(formatRelative('2026-03-31T10:00:00')).toBe('3h ago');
  });

  it('returns days ago', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-03T10:00:00'));
    expect(formatRelative('2026-03-31T10:00:00')).toBe('3d ago');
  });

  it('returns short date for >7 days', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-10T10:00:00'));
    const result = formatRelative('2026-03-31T10:00:00');
    expect(result).toContain('31');
    expect(result).toContain('Mar');
  });
});

describe('formatShortDate', () => {
  it('formats with weekday, day, short month, year', () => {
    const result = formatShortDate('2026-03-31');
    expect(result).toContain('Tue');
    expect(result).toContain('31');
    expect(result).toContain('Mar');
    expect(result).toContain('2026');
  });
});

describe('formatDateLong', () => {
  it('formats as "day month year"', () => {
    const result = formatDateLong('2026-03-31');
    expect(result).toContain('31');
    expect(result).toContain('March');
    expect(result).toContain('2026');
  });
});

describe('formatGBP', () => {
  it('formats amount with pound sign', () => {
    expect(formatGBP(150)).toBe('\u00A3150.00');
  });

  it('formats decimal amount', () => {
    expect(formatGBP(99.9)).toBe('\u00A399.90');
  });
});

describe('todayISO', () => {
  afterEach(() => { vi.useRealTimers(); });

  it('returns today in YYYY-MM-DD format', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-31T15:30:00'));
    expect(todayISO()).toBe('2026-03-31');
  });

  it('pads single-digit months and days', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-05T10:00:00'));
    expect(todayISO()).toBe('2026-01-05');
  });
});

describe('addDaysISO', () => {
  it('adds days to a date', () => {
    expect(addDaysISO('2026-03-31', 5)).toBe('2026-04-05');
  });

  it('handles month rollover', () => {
    expect(addDaysISO('2026-01-30', 3)).toBe('2026-02-02');
  });

  it('handles year rollover', () => {
    expect(addDaysISO('2026-12-30', 5)).toBe('2027-01-04');
  });

  it('handles negative days', () => {
    expect(addDaysISO('2026-03-31', -3)).toBe('2026-03-28');
  });
});
