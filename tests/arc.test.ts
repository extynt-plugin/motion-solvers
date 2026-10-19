// Geometry, timing and handle tests for solveArcPath.
import { expect, test } from "vitest";
import { solveArcPath } from "../src/index.js";
import { arc, expectClose, pos, times } from "./helpers.js";

test("half turn clockwise from the right of center", () => {
  const r = arc();
  expect(r).toMatchObject({ radius: 100, startAngle: 0, endAngle: 180, endPoint: [860, 540] });
  expect(r.arcLength).toBeCloseTo(314.159, 3);
  expect(r.position.keyframes).toHaveLength(4);
  expect(pos(r, 0)).toEqual([1060, 540]);
  expect(pos(r, 3)).toEqual([860, 540]);
  expect(pos(r, 1)[1]).toBeGreaterThan(540);
  expect(pos(r, 2)[1]).toBeGreaterThan(540);
  expect(r.position.propertyPath).toBe("ADBE Transform Group/ADBE Position");
});

test("every keyframe sits on the circle", () => {
  const r = arc({ sweep: 300, segments: 10 });
  for (let i = 0; i < r.position.keyframes.length; i++) {
    const [x, y] = pos(r, i);
    expectClose(Math.hypot(x - 960, y - 540), 100, 2);
  }
});

test("negative sweep goes counterclockwise (up first, y is down)", () => {
  const r = arc({ sweep: -180 });
  expect(pos(r, 1)[1]).toBeLessThan(540);
  expect(r.endAngle).toBe(-180);
  expect(r.endPoint).toEqual([860, 540]);
});

test("radius + startAngle equals the equivalent start form", () => {
  const a = arc();
  const b = solveArcPath({
    center: [960, 540],
    radius: 100,
    startAngle: 0,
    sweep: 180,
    startTime: 0,
    duration: 1,
    segments: 3,
  });
  expect(b).toEqual(a);
});

test("start below center gives startAngle 90", () => {
  const r = arc({ start: [960, 640] });
  expect(r.startAngle).toBe(90);
  expect(r.radius).toBe(100);
});

test("a 90 degree arc uses the standard Bezier handle length", () => {
  const r = arc({ sweep: 90, segments: 1, center: [0, 0], start: [100, 0] });
  const handle = r.position.keyframes[0]?.spatial?.outTangent;
  expect(handle).toEqual([0, 55.228]);
  expect(r.position.keyframes[1]?.spatial?.inTangent).toEqual([55.228, 0]);
});

test("end keyframes have zeroed outer handles and are not continuous", () => {
  const r = arc();
  const first = r.position.keyframes[0]?.spatial;
  const last = r.position.keyframes[3]?.spatial;
  expect(first).toMatchObject({ inTangent: [0, 0], continuous: false });
  expect(last).toMatchObject({ outTangent: [0, 0], continuous: false });
});

test("interior keyframes are continuous with opposite handles", () => {
  const r = arc();
  for (const i of [1, 2]) {
    const s = r.position.keyframes[i]?.spatial;
    expect(s?.continuous).toBe(true);
    expect(s?.inTangent[0]).toBeCloseTo(-(s?.outTangent[0] ?? 0), 3);
    expect(s?.inTangent[1]).toBeCloseTo(-(s?.outTangent[1] ?? 0), 3);
  }
});

test("all keyframes use linear temporal interpolation", () => {
  const r = arc({ orient: {} });
  for (const k of [...r.position.keyframes, ...(r.rotation?.keyframes ?? [])]) {
    expect(k.interpolation).toEqual({ inType: "LINEAR", outType: "LINEAR" });
  }
});

test("default segments follow the sweep", () => {
  expect(arc({ segments: undefined, sweep: 90 }).position.keyframes).toHaveLength(4);
  expect(arc({ segments: undefined, sweep: 10 }).position.keyframes).toHaveLength(3);
  expect(arc({ segments: undefined, sweep: 360 }).position.keyframes).toHaveLength(13);
});

test("a segment may turn at most 90 degrees: the boundary is accepted with the standard handle", () => {
  const handle = (r: ReturnType<typeof arc>): number => {
    const tangent = r.position.keyframes[0]?.spatial?.outTangent ?? [Number.NaN, Number.NaN];
    return Math.hypot(tangent[0], tangent[1]);
  };
  expectClose(handle(arc({ sweep: 90, segments: 1 })), 0.5523 * 100, 2);
  expectClose(handle(arc({ sweep: 360, segments: 4 })), 0.5523 * 100, 2);
});

test("a full 360 turn returns to the start point", () => {
  const r = arc({ sweep: 360, segments: 12 });
  expect(r.endPoint).toEqual([1060, 540]);
  expect(pos(r, 12)).toEqual(pos(r, 0));
});

test("sweep beyond one turn keeps winding", () => {
  const r = arc({ sweep: 720, segments: 24, orient: {} });
  const rot = r.rotation?.keyframes ?? [];
  expect((rot[24]?.value as number) - (rot[0]?.value as number)).toBe(720);
  expect(r.endAngle).toBe(720);
});

test("degenerate: tiny sweep still solves", () => {
  const r = arc({ sweep: 0.001, segments: 1, duration: 1 });
  expectClose(pos(r, 1)[1], 540.002, 3);
  expect(r.arcLength).toBeCloseTo(0.002, 3);
});

test("degenerate: a single segment with a huge radius stays finite", () => {
  const r = arc({ start: [1e7, 540], sweep: 90, segments: 1 });
  expect(Number.isFinite(r.arcLength)).toBe(true);
  expect(r.position.keyframes).toHaveLength(2);
});

test("results never contain negative zero", () => {
  const r = arc({ center: [0, 0], start: [100, 0], sweep: 180, segments: 2 });
  const json = JSON.stringify(r);
  expect(json).not.toContain("-0,");
  expect(Object.is(pos(r, 0)[1], -0)).toBe(false);
});

test("non-origin centers and fractional coordinates are handled", () => {
  const r = arc({ center: [12.5, -40.25], start: [12.5, -140.25], sweep: 90, segments: 2 });
  expect(r.startAngle).toBe(-90);
  expect(r.endPoint).toEqual([112.5, -40.25]);
});

test("times are strictly increasing for every speed profile", () => {
  for (const speed of ["constant", "accelerate", "decelerate", "ease-in-out"] as const) {
    const t = times(arc({ speed, segments: 12, duration: 4, startTime: 2 }));
    expect(t[0]).toBe(2);
    expect(t[12]).toBe(6);
    for (let i = 1; i < t.length; i++) expect(t[i]).toBeGreaterThan(t[i - 1] ?? 0);
  }
});

test("accelerate shortens segments over time, decelerate lengthens them", () => {
  const gaps = (speed: "accelerate" | "decelerate"): number[] => {
    const t = times(arc({ speed, segments: 6, duration: 6 }));
    return t.slice(1).map((v, i) => v - (t[i] ?? 0));
  };
  const acc = gaps("accelerate");
  const dec = gaps("decelerate");
  for (let i = 1; i < acc.length; i++) {
    expect(acc[i]).toBeLessThan((acc[i - 1] ?? 0) + 1e-9);
    expect(dec[i]).toBeGreaterThan((dec[i - 1] ?? 0) - 1e-9);
  }
});

test("ease-in-out has short gaps in the middle and long gaps at the ends", () => {
  const t = times(arc({ speed: "ease-in-out", segments: 8, duration: 8 }));
  const gaps = t.slice(1).map((v, i) => v - (t[i] ?? 0));
  expect(gaps[0] ?? 0).toBeGreaterThan(gaps[3] ?? 0);
  expect(gaps[7] ?? 0).toBeGreaterThan(gaps[4] ?? 0);
  expectClose(t[4] ?? 0, 4, 3);
});

test("constant speed spaces times evenly", () => {
  expect(times(arc({ startTime: 1, duration: 3 }))).toEqual([1, 2, 3, 4]);
});
