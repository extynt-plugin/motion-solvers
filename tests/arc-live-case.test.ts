// Pins the one arc case checked in After Effects 26.5 on Windows: a full orbit with orient, applied
// to a 2D layer and read back. Rows are time, x, y, inTangent, outTangent, continuous, rotation.
import { expect, test } from "vitest";
import { solveArcPath } from "../src/index.js";

const input = {
  center: [810, 675],
  start: [290, 675],
  sweep: 360,
  startTime: 0,
  duration: 6,
  speed: "constant",
  orient: { forwardAngle: 0 },
} as const;

const expected: ReadonlyArray<
  readonly [number, number, number, [number, number], [number, number], boolean, number]
> = [
  [0, 290, 675, [0, 0], [0, -91.279], false, -90],
  [0.5, 359.667, 415, [-45.64, 79.05], [45.64, -79.05], true, -60],
  [1, 550, 224.667, [-79.05, 45.64], [79.05, -45.64], true, -30],
  [1.5, 810, 155, [-91.279, 0], [91.279, 0], true, 0],
  [2, 1070, 224.667, [-79.05, -45.64], [79.05, 45.64], true, 30],
  [2.5, 1260.333, 415, [-45.64, -79.05], [45.64, 79.05], true, 60],
  [3, 1330, 675, [0, -91.279], [0, 91.279], true, 90],
  [3.5, 1260.333, 935, [45.64, -79.05], [-45.64, 79.05], true, 120],
  [4, 1070, 1125.333, [79.05, -45.64], [-79.05, 45.64], true, 150],
  [4.5, 810, 1195, [91.279, 0], [-91.279, 0], true, 180],
  [5, 550, 1125.333, [79.05, 45.64], [-79.05, -45.64], true, 210],
  [5.5, 359.667, 935, [45.64, 79.05], [-45.64, -79.05], true, 240],
  [6, 290, 675, [0, 91.279], [0, 0], false, 270],
];

test("full-circle orbit with orient matches the live-verified output key for key", () => {
  const r = solveArcPath({ ...input, center: [...input.center], start: [...input.start] });
  if (!r.ok) throw new Error(r.error);
  expect(r.radius).toBe(520);
  expect(r.startAngle).toBe(180);
  expect(r.endAngle).toBe(540);
  expect(r.endPoint).toEqual([290, 675]);
  expect(r.arcLength).toBe(3267.256);
  expect(r.position.keyframes).toHaveLength(expected.length);
  expect(r.rotation?.keyframes).toHaveLength(expected.length);
  expected.forEach(([time, x, y, inTangent, outTangent, continuous, rotation], i) => {
    const p = r.position.keyframes[i];
    expect(p?.time).toBe(time);
    expect(p?.value).toEqual([x, y]);
    expect(p?.spatial).toEqual({ inTangent, outTangent, continuous });
    expect(p?.interpolation).toEqual({ inType: "LINEAR", outType: "LINEAR" });
    expect(r.rotation?.keyframes[i]?.time).toBe(time);
    expect(r.rotation?.keyframes[i]?.value).toBe(rotation);
  });
});
