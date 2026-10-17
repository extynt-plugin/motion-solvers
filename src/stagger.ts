import type { SolverFailure } from "./types.js";
import { failure, round3 } from "./types.js";
import { checkFinite, checkOneOf, firstError } from "./validate.js";

export type StaggerOrder = "forward" | "reverse" | "center-out" | "edges-in" | "random";
export type StaggerCurve = "linear" | "ease-in" | "ease-out" | "ease-in-out";

export interface StaggerInput {
  /** Number of items, integer 1..1000. Item k is the k-th item the caller lists. */
  count: number;
  /** When the first-starting item starts (seconds, >= 0). */
  startTime: number;
  /** Seconds between consecutive start ranks. Give exactly one of step or total. */
  step?: number;
  /** Seconds from the first start to the last start. Give exactly one of step or total. */
  total?: number;
  /** Which items start first. Default "forward". */
  order?: StaggerOrder;
  /** Integer seed for order "random" (default 1); same seed gives the same result. */
  seed?: number;
  /** Spreads the start ranks non-uniformly across the span. Default "linear". */
  curve?: StaggerCurve;
  /** When given (> 0), ends[k] = starts[k] + itemDuration. */
  itemDuration?: number;
}

export interface StaggerResult {
  ok: true;
  /** starts[k] is item k's start time, in the caller's item order (not sorted by time). */
  starts: number[];
  /** Present only when itemDuration was given. */
  ends?: number[];
  /** ranks[k] is 0 for the items that start first; equal ranks start together. */
  ranks: number[];
  /** Seconds from the first start to the last start. */
  span: number;
  /** Time the last item ends (only when itemDuration is given). */
  end?: number;
}

const ORDERS: readonly StaggerOrder[] = ["forward", "reverse", "center-out", "edges-in", "random"];
const CURVES: readonly StaggerCurve[] = ["linear", "ease-in", "ease-out", "ease-in-out"];
const MAX_COUNT = 1000;
const MAX_SPAN = 3600;
const MAX_START_TIME = 1e6;
/** mulberry32 reads the seed as an unsigned 32-bit integer, so seeds outside 0..MAX_SEED would alias other seeds. */
const MAX_SEED = 4294967295;

function checkNonNegative(value: unknown, name: string): string | undefined {
  return firstError([
    () => checkFinite(value, name),
    () => ((value as number) < 0 ? `${name} must be non-negative` : undefined),
  ]);
}

function checkCount(count: unknown): string | undefined {
  if (!Number.isInteger(count)) return "count must be an integer";
  const n = count as number;
  return n < 1 || n > MAX_COUNT ? `count must be between 1 and ${MAX_COUNT}` : undefined;
}

function checkStepOrTotal(step: unknown, total: unknown): string | undefined {
  if ((step === undefined) === (total === undefined))
    return "must provide exactly one of step or total";
  return step === undefined ? checkNonNegative(total, "total") : checkNonNegative(step, "step");
}

function checkOptional(input: StaggerInput): string | undefined {
  const { seed, itemDuration } = input;
  return firstError([
    () => checkOneOf(input.order, ORDERS, "order"),
    () => checkOneOf(input.curve, CURVES, "curve"),
    () => (seed === undefined || Number.isInteger(seed) ? undefined : "seed must be an integer"),
    () =>
      seed === undefined || (seed >= 0 && seed <= MAX_SEED)
        ? undefined
        : `seed must be between 0 and ${MAX_SEED}`,
    () => (itemDuration === undefined ? undefined : checkFinite(itemDuration, "itemDuration")),
    () =>
      itemDuration !== undefined && itemDuration <= 0 ? "itemDuration must be positive" : undefined,
  ]);
}

function validate(input: StaggerInput): string | undefined {
  return firstError([
    () => checkCount(input.count),
    () => checkNonNegative(input.startTime, "startTime"),
    () => (input.startTime > MAX_START_TIME ? `startTime must be <= ${MAX_START_TIME}` : undefined),
    () => checkStepOrTotal(input.step, input.total),
    () => checkOptional(input),
  ]);
}

/** Rank of each item under "center-out": the center item(s) are 0, ties share a rank. */
function centerOutRanks(count: number): number[] {
  const center = (count - 1) / 2;
  const distances = Array.from({ length: count }, (_, k) => Math.round(Math.abs(k - center) * 1e9));
  const sorted = [...new Set(distances)].sort((a, b) => a - b);
  const rankOf = new Map(sorted.map((d, rank) => [d, rank]));
  return distances.map((d) => rankOf.get(d) ?? 0);
}

/** mulberry32 by Tommy Ettinger (public domain), as published at https://github.com/bryc/code/blob/master/jshash/PRNGs.md */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A seeded permutation: ranks[k] is the position of item k after a Fisher-Yates shuffle. */
function randomRanks(count: number, seed: number): number[] {
  const rng = mulberry32(seed);
  const items = Array.from({ length: count }, (_, k) => k);
  for (let i = count - 1; i >= 1; i--) {
    const j = Math.floor(rng() * (i + 1));
    [items[i], items[j]] = [items[j] ?? 0, items[i] ?? 0];
  }
  const ranks = new Array<number>(count).fill(0);
  items.forEach((item, position) => {
    ranks[item] = position;
  });
  return ranks;
}

function computeRanks(count: number, order: StaggerOrder, seed: number): number[] {
  const forward = Array.from({ length: count }, (_, k) => k);
  if (order === "forward") return forward;
  if (order === "reverse") return forward.map((k) => count - 1 - k);
  if (order === "random") return randomRanks(count, seed);
  const centered = centerOutRanks(count);
  if (order === "center-out") return centered;
  const max = Math.max(...centered);
  return centered.map((r) => max - r);
}

function applyCurve(f: number, curve: StaggerCurve): number {
  if (curve === "ease-in") return f * f;
  if (curve === "ease-out") return 1 - (1 - f) * (1 - f);
  if (curve === "ease-in-out") return f < 0.5 ? 2 * f * f : 1 - 2 * (1 - f) * (1 - f);
  return f;
}

/**
 * Computes a start time for each of `count` items. `step` gives seconds between consecutive ranks;
 * `total` fits all ranks into a fixed span. Returns `{ ok: false, error }` for invalid input.
 */
export function solveStagger(input: StaggerInput): StaggerResult | SolverFailure {
  const error = validate(input);
  if (error !== undefined) return failure(error);

  const ranks = computeRanks(input.count, input.order ?? "forward", input.seed ?? 1);
  const maxRank = Math.max(...ranks);
  const rawSpan = input.total ?? (input.step ?? 0) * maxRank;
  const span = maxRank === 0 ? 0 : rawSpan;
  if (span > MAX_SPAN) return failure(`span exceeds ${MAX_SPAN} seconds`);

  const curve = input.curve ?? "linear";
  const rawStarts = ranks.map(
    (r) => input.startTime + span * applyCurve(maxRank === 0 ? 0 : r / maxRank, curve),
  );
  const result: StaggerResult = {
    ok: true,
    starts: rawStarts.map(round3),
    ranks,
    span: round3(span),
  };
  if (input.itemDuration !== undefined) {
    const ends = rawStarts.map((s) => s + (input.itemDuration ?? 0));
    result.ends = ends.map(round3);
    result.end = round3(Math.max(...ends));
  }
  return result;
}
