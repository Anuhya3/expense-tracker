import { describe, it, expect } from 'vitest';
import { formatCurrency, formatDate, getCategoryInfo } from '../utils/format';

// ── formatCurrency ─────────────────────────────────────────────────────────

describe('formatCurrency', () => {
  it('formats a typical GBP amount with £ symbol and two decimal places', () => {
    expect(formatCurrency(1234.56)).toBe('£1,234.56');
  });

  it('formats zero as £0.00', () => {
    expect(formatCurrency(0)).toBe('£0.00');
  });

  it('formats negative amounts with a minus sign', () => {
    expect(formatCurrency(-42.5)).toBe('-£42.50');
  });

  it('adds thousands separators for large amounts', () => {
    expect(formatCurrency(1000000)).toBe('£1,000,000.00');
  });

  it('formats USD amounts with $ symbol when currency is USD', () => {
    const result = formatCurrency(99.99, 'USD');
    expect(result).toContain('99.99');
    expect(result).toContain('$');
  });

  it('formats EUR amounts with € symbol when currency is EUR', () => {
    const result = formatCurrency(50, 'EUR');
    expect(result).toContain('50');
    expect(result).toContain('€');
  });

  it('handles fractional pence correctly (rounds to 2 dp)', () => {
    // Intl.NumberFormat rounds — 10.555 → 10.56 in en-GB
    const result = formatCurrency(10.555);
    expect(result).toMatch(/£10\.5[56]/);
  });
});

// ── getCategoryInfo ────────────────────────────────────────────────────────

describe('getCategoryInfo', () => {
  it('returns the correct label for "food"', () => {
    expect(getCategoryInfo('food').label).toBe('Food & Dining');
  });

  it('returns an icon for every known category', () => {
    const categories = [
      'food', 'transport', 'housing', 'utilities', 'entertainment',
      'healthcare', 'shopping', 'education', 'travel', 'subscriptions', 'other',
    ];
    categories.forEach(cat => {
      const info = getCategoryInfo(cat);
      expect(info.icon).toBeTruthy();
      expect(info.color).toMatch(/^#/);
    });
  });

  it('falls back to "other" for an unknown category', () => {
    const info = getCategoryInfo('unicorn');
    expect(info.label).toBe('Other');
  });
});

// ── formatDate ────────────────────────────────────────────────────────────

describe('formatDate', () => {
  it('returns "Today" for today\'s ISO date string', () => {
    const today = new Date().toISOString();
    expect(formatDate(today)).toBe('Today');
  });

  it('returns "Yesterday" for yesterday\'s ISO date string', () => {
    const yesterday = new Date(Date.now() - 86_400_000).toISOString();
    expect(formatDate(yesterday)).toBe('Yesterday');
  });

  it('formats older dates as "dd MMM yyyy"', () => {
    // A fixed past date that is never today or yesterday
    expect(formatDate('2023-06-15T00:00:00.000Z')).toBe('15 Jun 2023');
  });
});
