// Types shared by the solvers. Coordinates are AE composition space (y down), angles are degrees
// with positive turning clockwise, and results are rounded to 3 decimals.
export type Vec2 = [number, number];

export interface SolverFailure {
  ok: false;
  error: string;
}

export interface Keyframe {
  time: number;
  value: number | Vec2;
  interpolation?: { inType: "LINEAR" | "BEZIER"; outType: "LINEAR" | "BEZIER" };
  spatial?: { inTangent: Vec2; outTangent: Vec2; continuous: boolean };
}

export interface KeyframeTrack {
  propertyPath: string;
  keyframes: Keyframe[];
}

export type SpeedProfile = "constant" | "accelerate" | "decelerate" | "ease-in-out";

export function failure(error: string): SolverFailure {
  return { ok: false, error };
}

export function round3(value: number): number {
  return Math.round(value * 1000) / 1000 + 0;
}
