import * as jscadModeling from "@jscad/modeling"
import { getJscadModelForFootprint } from "jscad-electronics/vanilla"

/**
 * Extent of the 3D body a footprinter string names, in the model's own frame
 * with z = 0 at the board surface.
 *
 * `zMin` is below zero for anything with through-board pins, which matters here
 * rather than being a curiosity: that is the space a floor boss stands in.
 */
export interface MeasuredFootprinterBody {
  size: { x: number; y: number; z: number }
  zMin: number
  zMax: number
}

/**
 * Measurements are a pure function of the footprinter string, and a board is
 * mostly the same handful of parts, so a board of fifty resistors builds one
 * model rather than fifty. `null` records a string that could not be built, so a
 * bad one is not retried per component.
 */
const measurementCache = new Map<string, MeasuredFootprinterBody | null>()

/**
 * Measures the body behind a `footprinter_string`.
 *
 * `cad_component` carries the *name* of a footprinter model, not its geometry:
 * the body is built downstream by the renderers, so a part authored by footprint
 * alone reaches the enclosure with a pad extent and no height. Building the same
 * model here is what lets a screw boss be checked against a part that never
 * authored a `cadModel`.
 *
 * Uses `jscad-electronics/vanilla`, which brings its own element factory instead
 * of React, so this costs the geometry kernel and nothing else.
 */
export const measureFootprinterBody = (
  footprinterString: string,
): MeasuredFootprinterBody | null => {
  const cached = measurementCache.get(footprinterString)
  if (cached !== undefined) return cached

  let measured: MeasuredFootprinterBody | null = null
  try {
    const { geometries } = getJscadModelForFootprint(
      footprinterString,
      jscadModeling as any,
    )
    const solids = (geometries as any[])
      .flat(Number.POSITIVE_INFINITY)
      .map((entry: any) => entry?.geom ?? entry)
      .filter((geom: any) => geom && (geom.polygons || geom.sides))

    const boxes = solids
      .map((geom: any) => jscadModeling.measurements.measureBoundingBox(geom))
      .filter((box: any) => Array.isArray(box?.[0]) && Array.isArray(box?.[1]))

    if (boxes.length > 0) {
      const min = [0, 1, 2].map((axis) =>
        Math.min(...boxes.map((box: any) => box[0][axis])),
      )
      const max = [0, 1, 2].map((axis) =>
        Math.max(...boxes.map((box: any) => box[1][axis])),
      )
      if (min.every(Number.isFinite) && max.every(Number.isFinite)) {
        measured = {
          size: {
            x: max[0]! - min[0]!,
            y: max[1]! - min[1]!,
            z: max[2]! - min[2]!,
          },
          zMin: min[2]!,
          zMax: max[2]!,
        }
      }
    }
  } catch {
    // A footprinter string this build cannot make a body for is not an error
    // here: the part still has its pads, and the enclosure reports that it could
    // not decide rather than pretending the part is flat.
    measured = null
  }

  measurementCache.set(footprinterString, measured)
  return measured
}
