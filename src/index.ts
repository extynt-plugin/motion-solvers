// Public entry point.
export { solveArcPath } from "./arc.js";
export type { ArcPathInput, ArcPathResult } from "./arc.js";
export { solveStagger } from "./stagger.js";
export type { StaggerCurve, StaggerInput, StaggerOrder, StaggerResult } from "./stagger.js";
export {
  arcPathToExtendScript,
  keyframesToExtendScript,
  propertyExpression,
  staggerToExtendScript,
} from "./extendscript.js";
export type { Keyframe, KeyframeTrack, SolverFailure, SpeedProfile, Vec2 } from "./types.js";
