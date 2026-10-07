import { test, expect } from 'bun:test';
import { dateAt, makePlan, missingPlan, renderSvg } from './index.js';
const now = new Date('2026-10-07T12:00:00Z');

test('calendar is Sunday-first, then next week, across years', () => {
  expect(dateAt('2025-12-28', 0, 6)).toBe('2026-01-03');
  expect(dateAt('2025-12-28', 1, 0)).toBe('2026-01-04');
  expect(() => dateAt('2026-01-05', 0, 0)).toThrow('Sunday');
});

test('continuous background and foreground targets use 1 and 50 total', () => {
  const plan = makePlan(now);
  expect(plan.days.length).toBe(364);
  expect(plan.paintedDays).toBe(82);
  expect(plan.totalCommits).toBe(4382);
  expect(plan.days[0].date).toBe('2025-10-08');
  expect(plan.days.at(-1).date).toBe('2026-10-06');
  for (let i = 1; i < plan.days.length; i++) expect(+new Date(plan.days[i].date) - +new Date(plan.days[i - 1].date)).toBe(86400000);
  expect(new Set(plan.days.map(d => d.date)).size).toBe(plan.days.length);
  const pixels = plan.days.filter(d => d.glyph !== 'background');
  expect(pixels.every(d => d.count === 50)).toBe(true);
  expect(pixels.some(d => [4, 5, 11, 17, 23, 29, 30, 34].includes(d.x))).toBe(false);
  expect(plan.days.filter(d => d.glyph === 'background').every(d => d.count === 1)).toBe(true);
  expect(() => makePlan(new Date('2026-01-01T00:00:00Z'))).toThrow('Future date');
});

test('upgrades existing 40-commit pixels with only 10 extra, and is idempotent', () => {
  const plan = makePlan(now);
  const old = new Map(plan.days.filter(d => d.glyph !== 'background').map(d => [d.date, 40]));
  const missing = missingPlan(plan, old);
  expect(missing.reduce((n, d) => n + d.missing, 0)).toBe(1102);
  expect(missing.filter(d => d.glyph !== 'background').every(d => d.missing === 10)).toBe(true);
  expect(missing.filter(d => d.glyph === 'background').every(d => d.missing === 1)).toBe(true);
  expect(missingPlan(plan, new Map(plan.days.map(d => [d.date, d.count])))).toEqual([]);
});

test('refuses to reduce existing art or silently accept out-of-range days', () => {
  const plan = makePlan(now);
  expect(() => missingPlan(plan, new Map([['2026-01-07', 51]]))).toThrow('refusing to rewrite');
  expect(() => missingPlan(plan, new Map([['2024-01-01', 1]]))).toThrow('refusing to rewrite');
});

test('full preview includes every target date and count', () => {
  const plan = makePlan(now);
  const svg = renderSvg(plan, { full: true });
  for (const day of plan.days) expect(svg).toContain(`${day.date}: ${day.count} art commits`);
  expect(svg).toContain('#0e4429');
  expect(svg).toContain('#39d353');
});
