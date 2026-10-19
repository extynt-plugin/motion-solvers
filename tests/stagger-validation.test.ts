// Input validation for solveStagger.
import { expect, test } from "vitest";
import type { StaggerInput } from "../src/index.js";
import { solveStagger } from "../src/index.js";
import { staggerError } from "./helpers.js";

type Case = [string, Partial<StaggerInput>, string];

const cases: Case[] = [
  ["zero count", { count: 0 }, "count must be between 1 and 1000"],
  ["negative count", { count: -3 }, "count must be between 1 and 1000"],
  ["count 1001", { count: 1001 }, "count must be between 1 and 1000"],
  ["fractional count", { count: 2.5 }, "count must be an integer"],
  ["NaN count", { count: Number.NaN }, "count must be an integer"],
  ["string count", { count: "3" as unknown as number }, "count must be an integer"],
  ["huge startTime", { startTime: 1e306 }, "startTime must be <= 1000000"],
  ["negative startTime", { startTime: -1 }, "startTime must be non-negative"],
  ["infinite startTime", { startTime: Infinity }, "startTime must be a finite number"],
  ["both step and total", { total: 1 }, "must provide exactly one of step or total"],
  ["neither step nor total", { step: undefined }, "must provide exactly one of step or total"],
  ["negative step", { step: -0.1 }, "step must be non-negative"],
  ["NaN step", { step: Number.NaN }, "step must be a finite number"],
  ["negative total", { step: undefined, total: -1 }, "total must be non-negative"],
  [
    "unknown order",
    { order: "spiral" as never },
    "order must be one of: forward, reverse, center-out, edges-in, random",
  ],
  [
    "unknown curve",
    { curve: "bounce" as never },
    "curve must be one of: linear, ease-in, ease-out, ease-in-out",
  ],
  ["fractional seed", { seed: 1.5 }, "seed must be an integer"],
  ["negative seed", { seed: -5 }, "seed must be between 0 and 4294967295"],
  ["seed 2^32", { seed: 4294967296 }, "seed must be between 0 and 4294967295"],
  ["zero itemDuration", { itemDuration: 0 }, "itemDuration must be positive"],
  ["negative itemDuration", { itemDuration: -1 }, "itemDuration must be positive"],
  ["infinite itemDuration", { itemDuration: Infinity }, "itemDuration must be a finite number"],
  ["span over 3600 from step", { count: 1000, step: 4 }, "span exceeds 3600 seconds"],
  ["span over 3600 from total", { step: undefined, total: 3601 }, "span exceeds 3600 seconds"],
];

test.each(cases)("rejects %s", (_name, overrides, message) => {
  expect(staggerError({ count: 5, startTime: 0, step: 0.1, ...overrides })).toBe(message);
});

test("a span of exactly 3600 is accepted", () => {
  expect(solveStagger({ count: 3, startTime: 0, total: 3600 }).ok).toBe(true);
});

test("the largest seed is accepted", () => {
  expect(
    solveStagger({ count: 3, startTime: 0, step: 0.1, order: "random", seed: 4294967295 }).ok,
  ).toBe(true);
});

test("a huge step is harmless with a single item", () => {
  expect(solveStagger({ count: 1, startTime: 0, step: 1e9 }).ok).toBe(true);
});
