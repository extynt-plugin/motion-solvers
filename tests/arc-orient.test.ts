// Rotation keyframes from solveArcPath's orient option.
import { expect, test } from "vitest";
import { arc, arcError } from "./helpers.js";

function rotations(overrides: Parameters<typeof arc>[0]): number[] {
  const r = arc({ orient: {}, ...overrides });
  return (r.rotation?.keyframes ?? []).map((k) => k.value as number);
}

test("no rotation track without orient", () => {
  expect(arc().rotation).toBeUndefined();
});

test("orient adds a rotation track on the Z rotate property", () => {
  const r = arc({ orient: {} });
  expect(r.rotation?.propertyPath).toBe("ADBE Transform Group/ADBE Rotate Z");
  expect(r.rotation?.keyframes).toHaveLength(4);
  expect(r.rotation?.keyframes.every((k) => k.spatial === undefined)).toBe(true);
});

test("rotation keyframes share the position keyframe times", () => {
  const r = arc({ orient: {}, speed: "ease-in-out" });
  const posTimes = r.position.keyframes.map((k) => k.time);
  expect(r.rotation?.keyframes.map((k) => k.time)).toEqual(posTimes);
});

test("clockwise from angle 0 faces down at rotation 90 when artwork points right", () => {
  expect(rotations({})[0]).toBe(90);
});

test("forwardAngle offsets the rotation", () => {
  expect(rotations({ orient: { forwardAngle: -90 } })[0]).toBe(180);
  expect(rotations({ orient: { forwardAngle: 90 } })[0]).toBe(0);
  expect(rotations({ orient: { forwardAngle: 180 } })[0]).toBe(-90);
});

test("rotation advances by the per-segment sweep", () => {
  expect(rotations({})).toEqual([90, 150, 210, 270]);
});

test("counterclockwise rotation decreases", () => {
  const rot = rotations({ sweep: -180 });
  expect(rot[0]).toBe(-90);
  expect(rot[3]).toBe(-270);
});

test("start rotation is normalized to (-180, 180]", () => {
  expect(rotations({ orient: { forwardAngle: -300 } })[0]).toBe(30);
  expect(rotations({ orient: { forwardAngle: 270 } })[0]).toBe(180);
  expect(rotations({ orient: { forwardAngle: 360 } })[0]).toBe(90);
});

test("a non-finite forwardAngle is rejected", () => {
  expect(arcError({ orient: { forwardAngle: Number.NaN } })).toBe(
    "orient.forwardAngle must be a finite number",
  );
});
