// Runs the generated ExtendScript against a fake After Effects object model.
import { runInNewContext } from "node:vm";
import { expect, test } from "vitest";
import {
  arcPathToExtendScript,
  keyframesToExtendScript,
  propertyExpression,
  staggerToExtendScript,
} from "../src/index.js";
import { arc, stagger } from "./helpers.js";

interface Call {
  method: string;
  args: unknown[];
}

class MockProperty {
  calls: Call[] = [];
  keys: number[] = [];
  nearestKeyIndex(time: number): number {
    return this.keys.indexOf(time) + 1;
  }
  setValueAtTime(time: number, value: unknown): void {
    this.keys.push(time);
    this.keys.sort((a, b) => a - b);
    this.calls.push({ method: "setValueAtTime", args: [time, value] });
  }
  setInterpolationTypeAtKey(...args: unknown[]): void {
    this.calls.push({ method: "setInterpolationTypeAtKey", args });
  }
  setSpatialTangentsAtKey(...args: unknown[]): void {
    this.calls.push({ method: "setSpatialTangentsAtKey", args });
  }
  setSpatialContinuousAtKey(...args: unknown[]): void {
    this.calls.push({ method: "setSpatialContinuousAtKey", args });
  }
}

function run(code: string, env: Record<string, unknown>): void {
  runInNewContext(code, { ...env });
}

const KFT = { LINEAR: "LINEAR", BEZIER: "BEZIER" };

function fakeLayer(props: Record<string, MockProperty>): unknown {
  const group = (name: string): unknown => ({
    property: (match: string) => props[`${name}/${match}`],
  });
  return { property: group };
}

test("propertyExpression chains property() calls for each path segment", () => {
  expect(propertyExpression("L", "A/B")).toBe('L.property("A").property("B")');
});

test("keyframesToExtendScript sets values, interpolation and spatial tangents", () => {
  const prop = new MockProperty();
  const r = arc({ sweep: 90, segments: 1, center: [0, 0], start: [100, 0] });
  const code = keyframesToExtendScript(r.position.keyframes, "somePropertyExpr");
  run(code, { somePropertyExpr: prop, KeyframeInterpolationType: KFT });
  const methods = prop.calls.map((c) => c.method);
  expect(methods.filter((m) => m === "setValueAtTime")).toHaveLength(2);
  expect(prop.calls[0]).toEqual({ method: "setValueAtTime", args: [0, [100, 0]] });
  expect(prop.calls).toContainEqual({
    method: "setSpatialTangentsAtKey",
    args: [1, [0, 0, 0], [0, 55.228, 0]],
  });
  expect(prop.calls).toContainEqual({ method: "setSpatialContinuousAtKey", args: [2, false] });
  expect(prop.calls).toContainEqual({
    method: "setInterpolationTypeAtKey",
    args: [1, "LINEAR", "LINEAR"],
  });
});

test("bezier interpolation names are emitted", () => {
  const prop = new MockProperty();
  const code = keyframesToExtendScript(
    [{ time: 1, value: 5, interpolation: { inType: "BEZIER", outType: "LINEAR" } }],
    "somePropertyExpr",
  );
  run(code, { somePropertyExpr: prop, KeyframeInterpolationType: KFT });
  expect(prop.calls[1]).toEqual({
    method: "setInterpolationTypeAtKey",
    args: [1, "BEZIER", "LINEAR"],
  });
});

test("a bare keyframe only sets its value", () => {
  const prop = new MockProperty();
  run(keyframesToExtendScript([{ time: 0.5, value: 3 }], "somePropertyExpr"), {
    somePropertyExpr: prop,
  });
  expect(prop.calls).toEqual([{ method: "setValueAtTime", args: [0.5, 3] }]);
});

test("generated code is ES3-friendly: no let, const or arrow functions", () => {
  const code = arcPathToExtendScript(arc({ orient: {} }), "layer");
  expect(code).not.toMatch(/\b(let|const)\b|=>/);
});

test("arcPathToExtendScript writes position and rotation tracks to the layer", () => {
  const position = new MockProperty();
  const rotation = new MockProperty();
  const layer = fakeLayer({
    "ADBE Transform Group/ADBE Position": position,
    "ADBE Transform Group/ADBE Rotate Z": rotation,
  });
  const code = arcPathToExtendScript(arc({ orient: {} }), "layer");
  run(code, { layer, KeyframeInterpolationType: KFT });
  expect(position.keys).toHaveLength(4);
  expect(rotation.keys).toHaveLength(4);
});

test("arcPathToExtendScript omits rotation when the result has none", () => {
  const code = arcPathToExtendScript(arc(), "layer");
  expect(code).toContain("ADBE Position");
  expect(code).not.toContain("ADBE Rotate Z");
});

test("staggerToExtendScript moves each layer's in-point to its start", () => {
  const layers = [
    { startTime: 0, inPoint: 0 },
    { startTime: 1, inPoint: 2 },
    { startTime: 0, inPoint: 0 },
  ];
  const code = staggerToExtendScript(stagger({ count: 3, startTime: 1, step: 0.5 }), "selected");
  run(code, { selected: layers });
  expect(layers[0]?.startTime).toBe(1);
  expect(layers[1]?.startTime).toBe(0.5);
  expect(layers[2]?.startTime).toBe(2);
});

test("staggerToExtendScript throws when the layer count differs", () => {
  const code = staggerToExtendScript(stagger({ count: 3, startTime: 0, step: 1 }), "selected");
  expect(() => {
    run(code, { selected: [{ startTime: 0, inPoint: 0 }] });
  }).toThrow("Expected 3 layers but got 1");
});

test("spatial tangents are always emitted as 3-element arrays", () => {
  const prop = new MockProperty();
  const r = arc({ sweep: 180, segments: 3 });
  run(keyframesToExtendScript(r.position.keyframes, "somePropertyExpr"), {
    somePropertyExpr: prop,
    KeyframeInterpolationType: KFT,
  });
  const tangentCalls = prop.calls.filter((c) => c.method === "setSpatialTangentsAtKey");
  expect(tangentCalls).toHaveLength(4);
  for (const call of tangentCalls) {
    expect((call.args[1] as number[]).length).toBe(3);
    expect((call.args[2] as number[]).length).toBe(3);
  }
});
