// Input checks shared by the solvers. Each returns an error message, or undefined when the value is
// valid.
import type { Vec2 } from "./types.js";

export type Check = () => string | undefined;

export function firstError(checks: Check[]): string | undefined {
  for (const check of checks) {
    const error = check();
    if (error !== undefined) return error;
  }
  return undefined;
}

export function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function checkFinite(value: unknown, name: string): string | undefined {
  return isFiniteNumber(value) ? undefined : `${name} must be a finite number`;
}

export function checkVec2(value: unknown, name: string): string | undefined {
  if (!Array.isArray(value) || value.length !== 2) return `${name} must be a 2-element array`;
  const [x, y] = value as unknown[];
  return isFiniteNumber(x) && isFiniteNumber(y)
    ? undefined
    : `${name} must contain 2 finite numbers`;
}

export function checkOneOf(
  value: unknown,
  allowed: readonly string[],
  name: string,
): string | undefined {
  if (value === undefined) return undefined;
  return allowed.includes(value as string)
    ? undefined
    : `${name} must be one of: ${allowed.join(", ")}`;
}

export function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}
