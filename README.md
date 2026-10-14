# motion-solvers

Pure-math motion solvers for animators and script authors. No dependencies, no host calls: numbers in, keyframes and start times out.

- **`solveArcPath`** moves a point along a circular arc and returns position keyframes with Bezier handles (and, optionally, rotation keyframes so the layer faces its direction of travel).
- **`solveStagger`** computes per-item start times for a group of layers: forward, reverse, from the center out, from the edges in, or seeded random, with optional easing across the group.
- **ExtendScript helpers** turn those results into a snippet you can paste into After Effects.

## Trademarks and third-party software

**extynt is an independent project. It is not affiliated with, endorsed by, sponsored by or approved by Adobe Inc. or any other company named in this section.**

- Adobe, After Effects and ExtendScript are either registered trademarks or trademarks of Adobe Inc. in the United States and/or other countries. Nothing here is Adobe code or documentation. Adobe effect and property match names (e.g. `ADBE ...`) are referenced only to interoperate with After Effects scripting.
- Node.js is a trademark of the OpenJS Foundation. npm is a package registry and command-line tool operated by GitHub, Inc. GitHub is a trademark of GitHub, Inc.
- Microsoft and TypeScript are trademarks of the Microsoft group of companies.
- Ubuntu is a trademark of Canonical Ltd. ESLint, Prettier and Vitest are open-source tools, named only to identify them.
- Third-party code: the `mulberry32` generator used for `order: "random"` is by Tommy Ettinger and is in the public domain. The credit is also in `src/stagger.ts`.

All other trademarks are the property of their respective owners. References are for identification and interoperability only.

Provided as is, without warranty. Use with Adobe software is subject to Adobe's own license terms.

The same text is in [NOTICE](NOTICE).

ESM only, ships its own types. The library is plain ES2022 with no dependencies and runs in any modern runtime; Node 20 or newer is only needed for the development tooling.

```sh
npm install motion-solvers
```

## Conventions

Coordinates are After Effects composition space: **x grows right, y grows down**. Angles are in degrees and a positive angle turns **clockwise on screen**, the same sense as AE's Rotation. Times are seconds. Results are rounded to 3 decimals.

Every solver returns either a result with `ok: true` or `{ ok: false, error: string }`. Invalid input never throws.

```ts
const result = solveStagger({ count: 0, startTime: 0, step: 0.1 });
if (!result.ok) console.error(result.error); // "count must be between 1 and 1000"
```

## Arc path

```
            startAngle = 270 (above)
                    .  *  .
               *               *
             *                   *
   180 --- *        center         * --- 0 (start)  ---->  sweep +90 (clockwise)
             *          +          *
               *               *
                    .  *  .
                  90 (below)
```

A layer starting at angle 0 (right of the center) with a positive `sweep` travels down and around, because y points down. The arc is built from cubic Bezier segments; more `segments` means a closer circle.

```ts
import { solveArcPath } from "motion-solvers";

const arc = solveArcPath({
  center: [960, 540],
  start: [1060, 540], // radius 100, startAngle 0 are derived from this
  sweep: 180, // half a turn, clockwise
  startTime: 0,
  duration: 1,
  speed: "ease-in-out",
  orient: { forwardAngle: 0 }, // also solve rotation; artwork points right at rotation 0
});

if (arc.ok) {
  arc.position.keyframes; // [{ time, value: [x, y], interpolation, spatial: { inTangent, outTangent, continuous } }, ...]
  arc.rotation?.keyframes; // [{ time, value: degrees, interpolation }, ...]
  arc.endPoint; // [860, 540]
  arc.arcLength; // 314.159
}
```

### `solveArcPath(input): ArcPathResult | SolverFailure`

| Input                   | Meaning                                                                                                                                                     |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `center: [x, y]`        | Circle center.                                                                                                                                              |
| `start: [x, y]`         | Starting point. Derives `radius` and `startAngle`. Use instead of the next two.                                                                             |
| `radius`, `startAngle`  | Circle radius (> 0) and start angle in degrees (0 = right of center, 90 = below).                                                                           |
| `sweep`                 | Degrees to travel. Positive is clockwise, negative counterclockwise. `0.001 <= abs(sweep) <= 3600`.                                                         |
| `startTime`, `duration` | Seconds. `0 <= startTime <= 1000000`, `duration > 0`.                                                                                                       |
| `speed?`                | `"constant"` (default), `"accelerate"`, `"decelerate"`, `"ease-in-out"`. Controls how progress along the arc relates to time.                               |
| `segments?`             | Integer 1 to 64. Keyframes = segments + 1. Default `min(64, max(2, ceil(abs(sweep) / 30)))`.                                                                |
| `orient?`               | `{ forwardAngle?: number }`. Adds a rotation track. `forwardAngle` is where the artwork points at rotation 0: 0 right (default), 90 down, -90 up, 180 left. |

Returns `position` and (with `orient`) `rotation` as `{ propertyPath, keyframes }`, plus `radius`, `startAngle`, `endAngle`, `endPoint` and `arcLength`. Spatial handles are relative to each keyframe, as in AE. End keyframes have a zero outer handle and are not continuous; interior ones are continuous. Rotation keeps winding past 360 for sweeps beyond one turn.

## Stagger

```
Start times as columns (one column = one step). # marks when an item starts.

forward       center-out    edges-in
    0 1 2 3       0 1 2         0 1 2
A   # . . .   A   . . #     A   # . .
B   . # . .   B   . # .     B   . # .
C   . . # .   C   # . .     C   . . #
D   . . . #   D   . # .     D   . # .
              E   . . #     E   # . .
```

```ts
import { solveStagger } from "motion-solvers";

const s = solveStagger({
  count: 5,
  startTime: 1,
  step: 0.1,
  order: "center-out",
  itemDuration: 0.5,
});
// s.starts -> [1.2, 1.1, 1, 1.1, 1.2]   start time of item k, in your item order
// s.ends   -> [1.7, 1.6, 1.5, 1.6, 1.7]
// s.ranks  -> [2, 1, 0, 1, 2]
// s.span   -> 0.2, s.end -> 1.7
```

### `solveStagger(input): StaggerResult | SolverFailure`

| Input             | Meaning                                                                                                                                             |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `count`           | Integer 1 to 1000.                                                                                                                                  |
| `startTime`       | Seconds, when the earliest item starts. `0` to `1000000`.                                                                                           |
| `step` or `total` | Give exactly one. `step` is seconds between consecutive ranks; `total` fits all ranks into a fixed number of seconds. The span may not exceed 3600. |
| `order?`          | `"forward"` (default), `"reverse"`, `"center-out"`, `"edges-in"`, `"random"`.                                                                       |
| `seed?`           | Integer for `"random"` (default 1). The same seed always gives the same order.                                                                      |
| `curve?`          | `"linear"` (default), `"ease-in"`, `"ease-out"`, `"ease-in-out"`. Redistributes starts across the span without changing the first or last.          |
| `itemDuration?`   | Seconds, `> 0`. Adds `ends` and `end`.                                                                                                              |

`starts[k]` is in **your** item order, not sorted by time. `ranks[k]` is 0 for the first starters; equal ranks start together. A single item, or a `step` of 0, gives a span of 0.

## After Effects ExtendScript

The helpers return ES3 source text. They do not talk to After Effects themselves, so they are safe to use from any Node tool; save the output as a `.jsx` file and run it with File > Scripts > Run Script File, or send it to After Effects from any tool that can run ExtendScript. Review the result in a scratch comp before relying on it in production work: the generated calls follow the AE scripting guide, and the tests run them against a mock, not a live AE. One arc case has been checked in real After Effects; see [Verification](#verification).

The `mulberry32` generator behind `order: "random"` is by Tommy Ettinger (public domain).

```ts
import { solveArcPath, arcPathToExtendScript } from "motion-solvers";

const arc = solveArcPath({
  center: [960, 540],
  start: [1060, 540],
  sweep: 270,
  startTime: 0,
  duration: 2,
  orient: {},
});
if (arc.ok) {
  console.log(arcPathToExtendScript(arc, "app.project.activeItem.layer(1)"));
}
```

Output (abridged):

```js
(function () {
  var targetProp = app.project.activeItem
    .layer(1)
    .property("ADBE Transform Group")
    .property("ADBE Position");
  var keyIndex;
  targetProp.setValueAtTime(0, [1060, 540]);
  keyIndex = targetProp.nearestKeyIndex(0);
  targetProp.setInterpolationTypeAtKey(
    keyIndex,
    KeyframeInterpolationType.LINEAR,
    KeyframeInterpolationType.LINEAR,
  );
  targetProp.setSpatialTangentsAtKey(keyIndex, [0, 0, 0], [0, 17.554, 0]);
  targetProp.setSpatialContinuousAtKey(keyIndex, false);
  // ...
})();
```

Stagger the selected layers (select them in the order of your item list):

```ts
import { solveStagger, staggerToExtendScript } from "motion-solvers";

const s = solveStagger({ count: 4, startTime: 0, step: 0.15 });
if (s.ok) console.log(staggerToExtendScript(s, "app.project.activeItem.selectedLayers"));
```

Each layer is shifted so its **in-point** lands on `starts[i]`. The script throws if the layer count differs from `count`.

| Function                                           | Purpose                                                         |
| -------------------------------------------------- | --------------------------------------------------------------- |
| `keyframesToExtendScript(keyframes, propertyExpr)` | Write any keyframe list to an ExtendScript property expression. |
| `arcPathToExtendScript(result, layerExpr)`         | Position (and rotation) keyframes onto a layer.                 |
| `staggerToExtendScript(result, layersExpr)`        | Shift a zero-based array of layers to their start times.        |
| `propertyExpression(layerExpr, "A/B")`             | Builds `layer.property("A").property("B")`.                     |

You can also skip the helpers and loop over `arc.position.keyframes` yourself in any script environment; the values are plain numbers and arrays.

### Limits

The output targets **2D layers with Position not separated** (a two-value Position property). On a 3D layer Position is three-valued and the generated two-value `setValueAtTime` calls are not valid; separated dimensions have no single Position property at all. Keyframe interpolation is LINEAR at every key, so with a `speed` other than `constant` the easing is piecewise-constant per segment: more `segments` approximate it more smoothly. Spatial tangents are written as `[x, y, 0]`, because After Effects rejects two-element arrays for `setSpatialTangentsAtKey`. `keyframesToExtendScript` inserts `propertyExpr` verbatim, so never pass it untrusted strings.

### Verification

On 2026-10-14, in After Effects 26.5 on Windows, the keyframes for one case were applied to a 2D layer (Position not separated) and read back, and rendered frames at 1, 2.5 and 5 seconds showed the layer travelling the circle nose first. The case: `center [810, 675]`, `start [290, 675]`, `sweep 360`, `startTime 0`, `duration 6`, `speed "constant"`, `orient: { forwardAngle: 0 }`. It produced 13 Position keys and 13 Rotation keys; the values read back from After Effects matched, and `tests/arc-live-case.test.ts` pins this output key for key. The keys came from the solver this package was extracted from, and `solveArcPath` returns identical output for the same input. The ExtendScript helpers were not what was run in After Effects, and the tangents were checked only through the rendered path, not read back as numbers.

Not verified in real After Effects: `solveStagger`, the sign convention of the spatial tangents in cases other than the one above (other sweeps, counterclockwise, other start angles), 3D Position, separated dimensions, speeds other than `constant`, and macOS.

## Development

```sh
npm ci
npm run check   # lint, format check, typecheck, tests with coverage, build
```

The lint rules cap files at 500 lines, functions at 80 lines, complexity at 10, nesting depth at 4 and parameters at 5, and forbid disable comments.

## License

MIT, copyright 2026 extynt. Extracted from extynt (https://extynt.com), an After Effects copilot.
