import type { Keyframe, KeyframeTrack, SolverFailure, SpeedProfile, Vec2 } from "./types.js";
import { failure, round3 } from "./types.js";
import {
  checkFinite,
  checkOneOf,
  checkVec2,
  distance,
  firstError,
  isFiniteNumber,
} from "./validate.js";

export interface ArcPathInput {
  /** Center of the circle the motion travels on. */
  center: Vec2;
  /** Where the motion starts. Radius and startAngle are derived from it; do not also pass them. */
  start?: Vec2;
  /** Circle radius (> 0). Use together with startAngle instead of start. */
  radius?: number;
  /** Degrees; 0 = right of center, 90 = below it (y is down). Use together with radius. */
  startAngle?: number;
  /** Degrees to travel: positive = clockwise on screen, negative = counterclockwise. 0 < |sweep| <= 3600. */
  sweep: number;
  /** Seconds, >= 0. */
  startTime: number;
  /** Seconds, > 0. */
  duration: number;
  /** Default "constant". */
  speed?: SpeedProfile;
  /** Path segments (keyframes = segments + 1), integer 1..64. Default max(2, ceil(|sweep| / 30)), capped at 64. */
  segments?: number;
  /** Also solve Rotation so the layer faces its direction of travel. */
  orient?: {
    /** Where the artwork points at rotation 0: 0 = right (default), 90 = down, -90 = up, 180 = left. */
    forwardAngle?: number;
  };
}

export interface ArcPathResult {
  ok: true;
  position: KeyframeTrack;
  /** Present only when `orient` was given. */
  rotation?: KeyframeTrack;
  radius: number;
  startAngle: number;
  endAngle: number;
  endPoint: Vec2;
  arcLength: number;
}

const SPEEDS: readonly SpeedProfile[] = ["constant", "accelerate", "decelerate", "ease-in-out"];
const DEG = Math.PI / 180;
const MAX_SEGMENTS = 64;
const MAX_START_TIME = 1e6;
const MIN_SWEEP = 0.001;
const POSITION_PATH = "ADBE Transform Group/ADBE Position";
const ROTATION_PATH = "ADBE Transform Group/ADBE Rotate Z";

interface Circle {
  center: Vec2;
  radius: number;
  startAngle: number;
}

interface Plan extends Circle {
  sweep: number;
  segments: number;
  times: number[];
}

/** Fraction of the duration at which progress p along the path is reached (inverse of the speed profile). */
function timeFraction(p: number, speed: SpeedProfile): number {
  if (speed === "constant") return p;
  if (speed === "accelerate") return Math.sqrt(p);
  if (speed === "decelerate") return 1 - Math.sqrt(1 - p);
  return p < 0.5 ? Math.sqrt(p / 2) : 1 - Math.sqrt((1 - p) / 2);
}

function normalizeAngle(angle: number): number {
  let normalized = angle % 360;
  if (normalized > 180) normalized -= 360;
  if (normalized <= -180) normalized += 360;
  return normalized;
}

function checkCircleInputs(input: ArcPathInput): string | undefined {
  const { start, radius, startAngle } = input;
  if (start !== undefined && (radius !== undefined || startAngle !== undefined)) {
    return "cannot pass both start and radius/startAngle";
  }
  if (start === undefined && (radius === undefined || startAngle === undefined)) {
    return "must pass either start or both radius and startAngle";
  }
  return firstError([
    () => (radius === undefined ? undefined : checkFinite(radius, "radius")),
    () => (radius !== undefined && radius <= 0 ? "radius must be > 0" : undefined),
    () => (startAngle === undefined ? undefined : checkFinite(startAngle, "startAngle")),
  ]);
}

function resolveCircle(input: ArcPathInput): Circle | string {
  const error = firstError([
    () => checkVec2(input.center, "center"),
    () => (input.start === undefined ? undefined : checkVec2(input.start, "start")),
    () => checkCircleInputs(input),
  ]);
  if (error !== undefined) return error;
  const { center, start } = input;
  if (start === undefined) {
    return { center, radius: input.radius ?? 0, startAngle: input.startAngle ?? 0 };
  }
  const radius = distance(start, center);
  if (radius === 0) return "start cannot equal center (radius must be > 0)";
  return {
    center,
    radius,
    startAngle: Math.atan2(start[1] - center[1], start[0] - center[0]) / DEG,
  };
}

function checkTiming(input: ArcPathInput): string | undefined {
  return firstError([
    () => checkFinite(input.sweep, "sweep"),
    () => (input.sweep === 0 ? "sweep must be non-zero" : undefined),
    () =>
      Math.abs(input.sweep) < MIN_SWEEP ? `sweep must satisfy |sweep| >= ${MIN_SWEEP}` : undefined,
    () => (Math.abs(input.sweep) > 3600 ? "sweep must satisfy |sweep| <= 3600" : undefined),
    () => checkFinite(input.startTime, "startTime"),
    () => (input.startTime < 0 ? "startTime must be >= 0" : undefined),
    () => (input.startTime > MAX_START_TIME ? `startTime must be <= ${MAX_START_TIME}` : undefined),
    () => checkFinite(input.duration, "duration"),
    () => (input.duration <= 0 ? "duration must be > 0" : undefined),
    () => checkOneOf(input.speed, SPEEDS, "speed"),
  ]);
}

function checkOrient(orient: unknown): string | undefined {
  if (orient === undefined) return undefined;
  return typeof orient === "object" && orient !== null && !Array.isArray(orient)
    ? undefined
    : "orient must be an object";
}

function checkSegments(segments: number): string | undefined {
  if (!Number.isInteger(segments) || segments < 1 || segments > MAX_SEGMENTS) {
    return "segments must be an integer 1..64";
  }
  return undefined;
}

function keyTimes(input: ArcPathInput, segments: number): number[] | string {
  const speed = input.speed ?? "constant";
  const times: number[] = [];
  for (let i = 0; i <= segments; i++) {
    times.push(round3(input.startTime + input.duration * timeFraction(i / segments, speed)));
  }
  for (let i = 1; i < times.length; i++) {
    if ((times[i] ?? 0) <= (times[i - 1] ?? 0)) {
      return `duration is too short for ${segments} segments; use fewer segments or a longer duration.`;
    }
  }
  return times;
}

function buildPlan(input: ArcPathInput): Plan | string {
  const circle = resolveCircle(input);
  if (typeof circle === "string") return circle;
  const timingError = checkTiming(input);
  if (timingError !== undefined) return timingError;
  const segments =
    input.segments ?? Math.min(MAX_SEGMENTS, Math.max(2, Math.ceil(Math.abs(input.sweep) / 30)));
  const error = firstError([
    () => checkSegments(segments),
    () => checkOrient(input.orient),
    () => {
      const forward = input.orient?.forwardAngle;
      return forward === undefined ? undefined : checkFinite(forward, "orient.forwardAngle");
    },
  ]);
  if (error !== undefined) return error;
  const times = keyTimes(input, segments);
  if (typeof times === "string") return times;
  return { ...circle, sweep: input.sweep, segments, times };
}

function pointAt(circle: Circle, degrees: number): Vec2 {
  const rad = degrees * DEG;
  return [
    circle.center[0] + circle.radius * Math.cos(rad),
    circle.center[1] + circle.radius * Math.sin(rad),
  ];
}

function round2(v: Vec2): Vec2 {
  return [round3(v[0]), round3(v[1])];
}

/** Position keyframes with cubic-Bezier handles that approximate a circular arc between keyframes. */
function positionKeyframes(plan: Plan): Keyframe[] {
  const delta = plan.sweep / plan.segments;
  const sign = plan.sweep > 0 ? 1 : -1;
  const handle = (4 / 3) * Math.tan((Math.abs(delta) * DEG) / 4) * plan.radius;
  const zero: Vec2 = [0, 0];
  return plan.times.map((time, i) => {
    const theta = plan.startAngle + delta * i;
    const rad = theta * DEG;
    const out: Vec2 = [-sign * handle * Math.sin(rad), sign * handle * Math.cos(rad)];
    const back: Vec2 = [-out[0], -out[1]];
    const first = i === 0;
    const last = i === plan.segments;
    return {
      time,
      value: round2(pointAt(plan, theta)),
      interpolation: { inType: "LINEAR", outType: "LINEAR" },
      spatial: {
        inTangent: first ? zero : round2(back),
        outTangent: last ? zero : round2(out),
        continuous: !first && !last,
      },
    };
  });
}

/** Rotation keyframes that keep the layer's forward direction tangent to the path. */
function rotationKeyframes(plan: Plan, forwardAngle: number): Keyframe[] {
  const delta = plan.sweep / plan.segments;
  const sign = plan.sweep > 0 ? 1 : -1;
  const first = normalizeAngle(plan.startAngle + 90 * sign - forwardAngle);
  return plan.times.map((time, i) => ({
    time,
    value: round3(first + delta * i),
    interpolation: { inType: "LINEAR", outType: "LINEAR" },
  }));
}

/**
 * Solves a circular arc as position keyframes (cubic-Bezier handles, constant or eased speed),
 * and optionally matching rotation keyframes. Returns `{ ok: false, error }` for invalid input.
 */
export function solveArcPath(input: ArcPathInput): ArcPathResult | SolverFailure {
  const plan = buildPlan(input);
  if (typeof plan === "string") return failure(plan);
  const endAngle = plan.startAngle + plan.sweep;
  const result: ArcPathResult = {
    ok: true,
    position: { propertyPath: POSITION_PATH, keyframes: positionKeyframes(plan) },
    radius: round3(plan.radius),
    startAngle: round3(plan.startAngle),
    endAngle: round3(endAngle),
    endPoint: round2(pointAt(plan, endAngle)),
    arcLength: round3(plan.radius * Math.abs(plan.sweep) * DEG),
  };
  if (input.orient !== undefined) {
    const forward = input.orient.forwardAngle;
    result.rotation = {
      propertyPath: ROTATION_PATH,
      keyframes: rotationKeyframes(plan, isFiniteNumber(forward) ? forward : 0),
    };
  }
  return result;
}
