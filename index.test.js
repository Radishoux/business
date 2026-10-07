import { test, expect } from 'bun:test';
import { dateAt, makePlan, renderSvg } from './index.js';

test('calendar is Sunday-first, then next week, across years', () => {
  expect(dateAt('2025-12-28', 0, 6)).toBe('2026-01-03');
  expect(dateAt('2025-12-28', 1, 0)).toBe('2026-01-04');
  expect(() => dateAt('2026-01-05', 0, 0)).toThrow('Sunday');
});

test('art contains past dates, empty gaps and unique days', () => {
  const plan = makePlan(new Date('2026-10-07T12:00:00Z'));
  expect(new Set(plan.days.map(d => d.date)).size).toBe(plan.days.length);
  expect(plan.days.every(d => d.date >= '2026-01-04' && d.date <= '2026-10-03')).toBe(true);
  expect(plan.days.some(d => [4, 5, 11, 17, 23, 29, 30, 34].includes(d.x))).toBe(false);
  expect(plan.totalCommits).toBe(plan.days.reduce((n, d) => n + d.count, 0));
  expect(() => makePlan(new Date('2026-01-01T00:00:00Z'))).toThrow('Future pixel');
});

test('every pixel renders with its date and commit count', () => {
  const plan = makePlan(new Date('2026-10-07T12:00:00Z'));
  const svg = renderSvg(plan);
  for (const day of plan.days) expect(svg).toContain(`${day.date}: ${day.count} art commits`);
  expect(svg.match(/<title>/g).length).toBe(39 * 7);
});
