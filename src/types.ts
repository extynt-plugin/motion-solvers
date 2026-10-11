/**
 * Shared contract for the solvers.
 *
 * Coordinates follow After Effects composition space: x grows right, y grows DOWN. Angles are in
 * degrees and a positive angle turns clockwise on screen, the same sense as AE's Rotation.
 */

/** A 2D point or vector `[x, y]`. */
export type Vec2 = [number, number];

/** Returned instead of a result when an input is invalid. `error` names the offending input. */
export interface SolverFailure {
  ok: false;
  error: string;
}

/** A single keyframe in a form that maps directly onto AE's keyframe API. */
export interface Keyframe {
  /** Seconds. */
  time: number;
  value: number | Vec2;
  interpolation?: { inType: "LINEAR" | "BEZIER"; outType: "LINEAR" | "BEZIER" };
  /** Spatial handles, relative to the keyframe value (AE convention). Position keyframes only. */
  spatial?: { inTangent: Vec2; outTangent: Vec2; continuous: boolean };
}

/** An animated property: where it lives plus its keyframes. */
export interface KeyframeTrack {
  /** After Effects property match-name path, e.g. "ADBE Transform Group/ADBE Position". */
  propertyPath: string;
  keyframes: Keyframe[];
}

/** How progress along a path relates to time. */
export type SpeedProfile = "constant" | "accelerate" | "decelerate" | "ease-in-out";

export function failure(error: string): SolverFailure {
  return { ok: false, error };
}

/** Rounds to 3 decimals so results are readable and stable; `+ 0` turns -0 into 0. */
export function round3(value: number): number {
  return Math.round(value * 1000) / 1000 + 0;
}
