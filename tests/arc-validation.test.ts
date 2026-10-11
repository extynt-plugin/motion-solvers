import { expect, test } from "vitest";
import type { ArcPathInput } from "../src/index.js";
import { solveArcPath } from "../src/index.js";
import { arcError } from "./helpers.js";

type Case = [string, Partial<ArcPathInput>, string];

const cases: Case[] = [
  ["start together with radius", { radius: 5 }, "cannot pass both start and radius/startAngle"],
  [
    "start together with startAngle",
    { startAngle: 5 },
    "cannot pass both start and radius/startAngle",
  ],
  [
    "radius without startAngle",
    { start: undefined, radius: 5 },
    "must pass either start or both radius and startAngle",
  ],
  [
    "neither start nor radius",
    { start: undefined },
    "must pass either start or both radius and startAngle",
  ],
  [
    "start equal to center",
    { start: [960, 540] },
    "start cannot equal center (radius must be > 0)",
  ],
  ["zero radius", { start: undefined, radius: 0, startAngle: 0 }, "radius must be > 0"],
  ["negative radius", { start: undefined, radius: -4, startAngle: 0 }, "radius must be > 0"],
  [
    "infinite radius",
    { start: undefined, radius: Infinity, startAngle: 0 },
    "radius must be a finite number",
  ],
  [
    "NaN startAngle",
    { start: undefined, radius: 4, startAngle: Number.NaN },
    "startAngle must be a finite number",
  ],
  ["NaN center", { center: [Number.NaN, 0] }, "center must contain 2 finite numbers"],
  [
    "short center",
    { center: [1] as unknown as [number, number] },
    "center must be a 2-element array",
  ],
  [
    "non-array center",
    { center: "x" as unknown as [number, number] },
    "center must be a 2-element array",
  ],
  [
    "string in start",
    { start: ["a", 1] as unknown as [number, number] },
    "start must contain 2 finite numbers",
  ],
  ["zero sweep", { sweep: 0 }, "sweep must be non-zero"],
  ["NaN sweep", { sweep: Number.NaN }, "sweep must be a finite number"],
  ["sweep over 3600", { sweep: 3601 }, "sweep must satisfy |sweep| <= 3600"],
  ["sweep under -3600", { sweep: -3601 }, "sweep must satisfy |sweep| <= 3600"],
  ["tiny sweep", { sweep: 1e-9 }, "sweep must satisfy |sweep| >= 0.001"],
  ["negative startTime", { startTime: -1 }, "startTime must be >= 0"],
  ["huge startTime", { startTime: 1e306 }, "startTime must be <= 1000000"],
  ["non-object orient", { orient: 5 as never }, "orient must be an object"],
  ["null orient", { orient: null as never }, "orient must be an object"],
  ["infinite startTime", { startTime: Infinity }, "startTime must be a finite number"],
  ["zero duration", { duration: 0 }, "duration must be > 0"],
  ["negative duration", { duration: -2 }, "duration must be > 0"],
  [
    "unknown speed",
    { speed: "fast" as never },
    "speed must be one of: constant, accelerate, decelerate, ease-in-out",
  ],
  ["zero segments", { segments: 0 }, "segments must be an integer 1..64"],
  ["65 segments", { segments: 65 }, "segments must be an integer 1..64"],
  ["fractional segments", { segments: 2.5 }, "segments must be an integer 1..64"],
  ["negative segments", { segments: -3 }, "segments must be an integer 1..64"],
];

test.each(cases)("rejects %s", (_name, overrides, message) => {
  expect(arcError(overrides)).toBe(message);
});

test("boundary values are accepted", () => {
  for (const overrides of [
    { segments: 1 },
    { segments: 64, duration: 100 },
    { sweep: 3600, segments: 64 },
  ]) {
    expect(
      solveArcPath({
        center: [0, 0],
        start: [1, 0],
        sweep: 90,
        startTime: 0,
        duration: 1,
        ...overrides,
      }).ok,
    ).toBe(true);
  }
});

test("rejects a duration too short for the number of segments", () => {
  expect(arcError({ segments: 64, duration: 0.01 })).toMatch(
    /duration is too short for 64 segments/,
  );
});

test("the first error wins when several inputs are bad", () => {
  expect(arcError({ center: [Number.NaN, 0], sweep: 0, duration: -1 })).toBe(
    "center must contain 2 finite numbers",
  );
});

test("default segments are clamped to 64 for the largest sweeps", () => {
  for (const sweep of [2000, 3600, -3600]) {
    const result = solveArcPath({
      center: [0, 0],
      start: [1, 0],
      sweep,
      startTime: 0,
      duration: 1,
    });
    expect(result.ok && result.position.keyframes.length).toBe(65);
  }
});
