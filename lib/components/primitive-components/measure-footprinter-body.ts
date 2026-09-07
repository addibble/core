import * as jscad from "@jscad/modeling"
import type { Geom3 } from "@jscad/modeling/src/geometries/types"
import type { CadModelBounds } from "@tscircuit/circuit-json-util"
import { getJscadModelForFootprint } from "jscad-electronics/vanilla"

/** Native right-handed Z-up mm, with the board contact datum at (0, 0, 0). */
export interface MeasuredFootprinterBody {
  solids: Geom3[]
  bounds: CadModelBounds
  size: { x: number; y: number; z: number }
  zMin: number
  zMax: number
}

const measurementCache = new Map<string, MeasuredFootprinterBody | null>()

/** Preserve native solids so bounds and collision geometry share one placement. */
export const measureFootprinterBody = (
  footprinterString: string,
): MeasuredFootprinterBody | null => {
  const cached = measurementCache.get(footprinterString)
  if (cached !== undefined) return cached

  const { geometries } = getJscadModelForFootprint(footprinterString, jscad)
  const solids = geometries
    .map(({ geom }) => geom)
    .filter(
      (geom): geom is Geom3 =>
        jscad.geometries.geom3.isA(geom) &&
        jscad.geometries.geom3.toPolygons(geom).length > 0,
    )
  if (solids.length === 0) {
    measurementCache.set(footprinterString, null)
    return null
  }
  const [min, max] = jscad.measurements.measureAggregateBoundingBox(solids)
  const measured: MeasuredFootprinterBody = {
    solids,
    bounds: {
      min: { x: min[0], y: min[1], z: min[2] },
      max: { x: max[0], y: max[1], z: max[2] },
    },
    size: { x: max[0] - min[0], y: max[1] - min[1], z: max[2] - min[2] },
    zMin: min[2],
    zMax: max[2],
  }
  measurementCache.set(footprinterString, measured)
  return measured
}
