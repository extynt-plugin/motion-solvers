// Test fixtures: a base arc input, helpers that unwrap ok and error results, and a closeness check.
import { expect } from "vitest";
import { solveArcPath, solveStagger } from "../src/index.js";
import type { ArcPathInput, ArcPathResult, StaggerInput, StaggerResult } from "../src/index.js";

export const baseArc: ArcPathInput = {
  center: [960, 540],
  start: [1060, 540],
  sweep: 180,
  startTime: 0,
  duration: 1,
  segments: 3,
};

export function arc(overrides: Partial<ArcPathInput> = {}): ArcPathResult {
  const result = solveArcPath({ ...baseArc, ...overrides });
  if (!result.ok) throw new Error(`expected ok, got: ${result.error}`);
  return result;
}

export function arcError(overrides: Partial<ArcPathInput> = {}): string {
  const result = solveArcPath({ ...baseArc, ...overrides });
  if (result.ok) throw new Error("expected a failure");
  return result.error;
}

export function stagger(input: StaggerInput): StaggerResult {
  const result = solveStagger(input);
  if (!result.ok) throw new Error(`expected ok, got: ${result.error}`);
  return result;
}

export function staggerError(input: StaggerInput): string {
  const result = solveStagger(input);
  if (result.ok) throw new Error("expected a failure");
  return result.error;
}

export function pos(result: ArcPathResult, i: number): [number, number] {
  const value = result.position.keyframes[i]?.value;
  if (!Array.isArray(value)) throw new Error("missing position keyframe");
  return [value[0], value[1]];
}

export function times(result: ArcPathResult): number[] {
  return result.position.keyframes.map((k) => k.time);
}

export function expectClose(actual: number, expected: number, digits = 3): void {
  expect(actual).toBeCloseTo(expected, digits);
}
