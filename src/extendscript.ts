// Turns solver results into ES3 ExtendScript wrapped in an IIFE. Spatial tangents are written as
// three values because setSpatialTangentsAtKey rejects two, even on a 2D property.
import type { ArcPathResult } from "./arc.js";
import type { StaggerResult } from "./stagger.js";
import type { Keyframe, Vec2 } from "./types.js";

const LINEAR = "KeyframeInterpolationType.LINEAR";
const BEZIER = "KeyframeInterpolationType.BEZIER";

function literal(value: number | number[]): string {
  return Array.isArray(value) ? `[${value.join(", ")}]` : String(value);
}

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

export function propertyExpression(layerExpression: string, propertyPath: string): string {
  const chain = propertyPath.split("/").map((name) => `.property(${JSON.stringify(name)})`);
  return `${layerExpression}${chain.join("")}`;
}

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
