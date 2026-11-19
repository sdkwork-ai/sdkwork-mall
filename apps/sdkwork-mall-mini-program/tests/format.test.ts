/**
 * Display-formatter contracts.
 *
 * A wire value can be `null`, a real zero, a decimal string converted to a
 * non-finite number, or negative (a debit). The money formatter used to print
 * `¥NaN`/`¥Infinity` and put the sign after the symbol (`¥-5.00`).
 */
import { describe, expect, it } from "vitest";

import { formatCny, formatPoints, formatTime, statusLabel } from "../src/utils/format";

describe("formatCny", () => {
  it("formats finite amounts with two decimals", () => {
    expect(formatCny(0)).toBe("¥0.00");
    expect(formatCny(12.5)).toBe("¥12.50");
    expect(formatCny(199.999)).toBe("¥200.00");
  });

  it("renders the sign before the symbol", () => {
    expect(formatCny(-5)).toBe("-¥5.00");
  });

  it("falls back for missing or non-finite values", () => {
    expect(formatCny(null)).toBe("--");
    expect(formatCny(undefined)).toBe("--");
    expect(formatCny(Number.NaN)).toBe("--");
    expect(formatCny(Number.POSITIVE_INFINITY)).toBe("--");
  });
});

describe("formatPoints", () => {
  it("groups counts and keeps zero", () => {
    expect(formatPoints(0)).toBe("0");
    expect(formatPoints(12345)).toBe("12,345");
    expect(formatPoints(-1200)).toBe("-1,200");
  });

  it("falls back for missing or non-finite values", () => {
    expect(formatPoints(null)).toBe("--");
    expect(formatPoints(Number.NaN)).toBe("--");
  });
});

describe("formatTime / statusLabel", () => {
  it("formats ISO timestamps and rejects invalid ones", () => {
    expect(formatTime("2026-11-19T05:00:00.000Z")).toMatch(/^2026-11-19 \d{2}:\d{2}$/u);
    expect(formatTime("not-a-date")).toBe("not-a-date");
    expect(formatTime("")).toBe("--");
  });

  it("maps wire statuses to shopper labels", () => {
    expect(statusLabel("pending_payment")).toBe("待付款");
    expect(statusLabel("COMPLETED")).toBe("已完成");
    expect(statusLabel("something_else")).toBe("处理中");
  });
});
