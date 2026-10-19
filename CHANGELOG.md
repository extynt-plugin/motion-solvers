# Changelog

## Unreleased

- The README input tables now state the segment limit and seed range added in 0.1.2.
- Source comments are gone apart from a short header per file, so the published type declarations no longer carry doc comments. The README is the API reference. No change to library behavior.

## 0.1.2

- `solveArcPath` rejects an explicit `segments` count that leaves a segment turning more than 90 degrees, for example `sweep: 360, segments: 1`. A segment's Bezier handle only approximates the arc up to 90 degrees; past that the handle reversed, vanished or grew far too long. The error gives the minimum count, `ceil(|sweep| / 90)`. The default segment count is unaffected.
- `solveStagger` rejects a `seed` outside 0 to 4294967295. Negative seeds and seeds of 2^32 or more were silently mapped onto the sequence of another seed.

## 0.1.1

- Verified one `solveArcPath` case in After Effects 26.5 on Windows (full circle, constant speed, with `orient`, 2D layer, Position not separated). The README now says what is and is not covered, and `tests/arc-live-case.test.ts` pins that output.
- No change to library behavior.

## 0.1.0

- Initial release: `solveArcPath`, `solveStagger` and the ExtendScript helpers.
