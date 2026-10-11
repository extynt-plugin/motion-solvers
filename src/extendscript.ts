/**
 * Turns solver output into ExtendScript (ES3) source that can be saved as a .jsx file and run
 * with File > Scripts > Run Script File, or sent to After Effects by any tool that can run ExtendScript. The generated code is wrapped in an IIFE so it leaves no globals.
 */
import type { ArcPathResult } from "./arc.js";
import type { StaggerResult } from "./stagger.js";
import type { Keyframe, Vec2 } from "./types.js";

const LINEAR = "KeyframeInterpolationType.LINEAR";
const BEZIER = "KeyframeInterpolationType.BEZIER";

function literal(value: number | number[]): string {
  return Array.isArray(value) ? `[${value.join(", ")}]` : String(value);
}

/** AE's setSpatialTangentsAtKey requires 3-element arrays, even on a 2D property. */
function tangentLiteral(tangent: Vec2): string {
  return literal([tangent[0], tangent[1], 0]);
}

function interpolationName(kind: "LINEAR" | "BEZIER"): string {
  return kind === "LINEAR" ? LINEAR : BEZIER;
}

function keyframeLines(frame: Keyframe): string[] {
  const lines = [
    `targetProp.setValueAtTime(${frame.time}, ${literal(frame.value)});`,
    `keyIndex = targetProp.nearestKeyIndex(${frame.time});`,
  ];
  if (frame.interpolation !== undefined) {
    const { inType, outType } = frame.interpolation;
    lines.push(
      `targetProp.setInterpolationTypeAtKey(keyIndex, ${interpolationName(inType)}, ${interpolationName(outType)});`,
    );
  }
  if (frame.spatial !== undefined) {
    const { inTangent, outTangent, continuous } = frame.spatial;
    lines.push(
      `targetProp.setSpatialTangentsAtKey(keyIndex, ${tangentLiteral(inTangent)}, ${tangentLiteral(outTangent)});`,
    );
    lines.push(`targetProp.setSpatialContinuousAtKey(keyIndex, ${String(continuous)});`);
  }
  return lines;
}

/** `layer.property("A").property("B")` for a match-name path "A/B". */
export function propertyExpression(layerExpression: string, propertyPath: string): string {
  const chain = propertyPath.split("/").map((name) => `.property(${JSON.stringify(name)})`);
  return `${layerExpression}${chain.join("")}`;
}

/**
 * ExtendScript that writes `keyframes` onto the property returned by `propertyExpr`, an
 * ExtendScript expression such as `app.project.activeItem.layer(1).property("ADBE Transform Group").property("ADBE Position")`.
 * Existing keyframes at the same times are replaced; others are left alone.
 */
export function keyframesToExtendScript(keyframes: Keyframe[], propertyExpr: string): string {
  const body = keyframes.flatMap(keyframeLines).map((line) => `  ${line}`);
  return [
    "(function () {",
    `  var targetProp = ${propertyExpr};`,
    "  var keyIndex;",
    ...body,
    "})();",
  ].join("\n");
}

/**
 * ExtendScript that applies an arc path to `layerExpression` (an expression evaluating to a
 * Layer): position keyframes, plus rotation keyframes when the result has them.
 */
export function arcPathToExtendScript(result: ArcPathResult, layerExpression: string): string {
  const tracks =
    result.rotation === undefined ? [result.position] : [result.position, result.rotation];
  return tracks
    .map((track) =>
      keyframesToExtendScript(
        track.keyframes,
        propertyExpression(layerExpression, track.propertyPath),
      ),
    )
    .join("\n");
}

/**
 * ExtendScript that shifts each layer so its in-point lands on `result.starts[i]`.
 * `layersExpression` must evaluate to a zero-based array of layers in the same order the
 * stagger was solved for, such as `app.project.activeItem.selectedLayers`. The script throws if
 * the layer count differs from the solved count.
 */
export function staggerToExtendScript(result: StaggerResult, layersExpression: string): string {
  return [
    "(function () {",
    `  var targetLayers = ${layersExpression};`,
    `  var startTimes = ${literal(result.starts)};`,
    "  if (targetLayers.length !== startTimes.length) {",
    `    throw new Error("Expected " + startTimes.length + " layers but got " + targetLayers.length);`,
    "  }",
    "  for (var i = 0; i < startTimes.length; i++) {",
    "    targetLayers[i].startTime += startTimes[i] - targetLayers[i].inPoint;",
    "  }",
    "})();",
  ].join("\n");
}
