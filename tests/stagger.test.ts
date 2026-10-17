import { expect, test } from "vitest";
import { stagger } from "./helpers.js";

test("a single item with total has span 0, since every start is identical", () => {
  const r = stagger({ count: 1, startTime: 2, total: 1 });
  expect(r.starts).toEqual([2]);
  expect(r.span).toBe(0);
});

test("forward order, 5 items", () => {
  const r = stagger({ count: 5, startTime: 1, step: 0.1 });
  expect(r.starts).toEqual([1, 1.1, 1.2, 1.3, 1.4]);
  expect(r.ranks).toEqual([0, 1, 2, 3, 4]);
  expect(r.span).toBe(0.4);
  expect(r.ends).toBeUndefined();
  expect(r.end).toBeUndefined();
});

test("reverse order", () => {
  const r = stagger({ count: 5, startTime: 1, step: 0.1, order: "reverse" });
  expect(r.starts).toEqual([1.4, 1.3, 1.2, 1.1, 1]);
  expect(r.ranks).toEqual([4, 3, 2, 1, 0]);
});

test("center-out with an odd count starts the middle item first", () => {
  const r = stagger({ count: 5, startTime: 0, step: 0.2, order: "center-out" });
  expect(r.ranks).toEqual([2, 1, 0, 1, 2]);
  expect(r.starts).toEqual([0.4, 0.2, 0, 0.2, 0.4]);
});

test("center-out with an even count starts the two middle items together", () => {
  const r = stagger({ count: 4, startTime: 0, step: 0.2, order: "center-out" });
  expect(r.ranks).toEqual([1, 0, 0, 1]);
  expect(r.span).toBe(0.2);
});

test("edges-in starts the outer items first", () => {
  const r = stagger({ count: 5, startTime: 0, step: 0.2, order: "edges-in" });
  expect(r.ranks).toEqual([0, 1, 2, 1, 0]);
  expect(r.starts).toEqual([0, 0.2, 0.4, 0.2, 0]);
});

test("total fits all ranks into a fixed span", () => {
  const r = stagger({ count: 11, startTime: 0, total: 1 });
  expect(r.starts[0]).toBe(0);
  expect(r.starts[5]).toBe(0.5);
  expect(r.starts[10]).toBe(1);
  expect(r.span).toBe(1);
});

test("total of zero starts everything together", () => {
  expect(stagger({ count: 3, startTime: 2, total: 0 }).starts).toEqual([2, 2, 2]);
});

test("step of zero starts everything together", () => {
  expect(stagger({ count: 3, startTime: 2, step: 0 }).starts).toEqual([2, 2, 2]);
});

test("ease-in bunches starts early, ease-out bunches them late", () => {
  const input = { count: 3, startTime: 0, total: 1 } as const;
  expect(stagger({ ...input, curve: "ease-in" }).starts).toEqual([0, 0.25, 1]);
  expect(stagger({ ...input, curve: "ease-out" }).starts).toEqual([0, 0.75, 1]);
});

test("ease-in-out is symmetric about the middle", () => {
  const r = stagger({ count: 5, startTime: 0, total: 1, curve: "ease-in-out" });
  expect(r.starts).toEqual([0, 0.125, 0.5, 0.875, 1]);
});

test("every curve keeps the first and last starts on the span ends", () => {
  for (const curve of ["linear", "ease-in", "ease-out", "ease-in-out"] as const) {
    const r = stagger({ count: 7, startTime: 3, total: 2, curve });
    expect(r.starts[0]).toBe(3);
    expect(r.starts[6]).toBe(5);
  }
});

test("random is deterministic per seed and differs between seeds", () => {
  const a = stagger({ count: 20, startTime: 0, step: 0.1, order: "random", seed: 7 });
  const b = stagger({ count: 20, startTime: 0, step: 0.1, order: "random", seed: 7 });
  const c = stagger({ count: 20, startTime: 0, step: 0.1, order: "random", seed: 8 });
  expect(a).toEqual(b);
  expect(a.ranks).not.toEqual(c.ranks);
});

test("random ranks are a permutation of 0..count-1", () => {
  const r = stagger({ count: 50, startTime: 0, step: 0.1, order: "random", seed: 42 });
  expect([...r.ranks].sort((x, y) => x - y)).toEqual(Array.from({ length: 50 }, (_, i) => i));
});

test("random defaults to seed 1, and accepts seed 0", () => {
  const base = { count: 10, startTime: 0, step: 0.1, order: "random" } as const;
  expect(stagger(base)).toEqual(stagger({ ...base, seed: 1 }));
  expect(stagger({ ...base, seed: 0 }).ranks).toHaveLength(10);
});

test("itemDuration adds ends and the overall end", () => {
  const r = stagger({ count: 3, startTime: 1, step: 0.5, itemDuration: 2 });
  expect(r.ends).toEqual([3, 3.5, 4]);
  expect(r.end).toBe(4);
});

test("end follows the latest finisher under reverse order", () => {
  const r = stagger({ count: 3, startTime: 0, step: 1, order: "reverse", itemDuration: 0.5 });
  expect(r.ends).toEqual([2.5, 1.5, 0.5]);
  expect(r.end).toBe(2.5);
});

test("a single item starts at startTime with zero span", () => {
  const r = stagger({ count: 1, startTime: 4, step: 9, itemDuration: 1 });
  expect(r).toMatchObject({ starts: [4], ranks: [0], span: 0, ends: [5], end: 5 });
});

test("a single item reports zero span even when total is given", () => {
  expect(stagger({ count: 1, startTime: 0, total: 5 }).span).toBe(0);
});

test("order and curve default to forward and linear", () => {
  const defaults = stagger({ count: 4, startTime: 0, step: 1 });
  const explicit = stagger({ count: 4, startTime: 0, step: 1, order: "forward", curve: "linear" });
  expect(defaults).toEqual(explicit);
});

test("the maximum count of 1000 solves", () => {
  const r = stagger({ count: 1000, startTime: 0, step: 0.001 });
  expect(r.starts).toHaveLength(1000);
  expect(r.starts[999]).toBe(0.999);
});

test("large floating point steps stay rounded to 3 decimals", () => {
  const r = stagger({ count: 4, startTime: 0, step: 1 / 3 });
  expect(r.starts).toEqual([0, 0.333, 0.667, 1]);
});

test("every order handles two items", () => {
  for (const order of ["forward", "reverse", "center-out", "edges-in", "random"] as const) {
    const r = stagger({ count: 2, startTime: 0, step: 1, order });
    expect(r.starts).toHaveLength(2);
  }
});
