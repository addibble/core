import * as jscad from "@jscad/modeling"
import {
  getCadModelPlacement,
  mat4,
  type CadModelBounds,
} from "@tscircuit/circuit-json-util"
import type {
  EnclosureComponentBody,
  FdmComponentSolid,
} from "@tscircuit/create-fdm-enclosure"
import type { cadModelBase } from "@tscircuit/props"
import type { CadComponent, PcbComponent } from "circuit-json"
import { assertTransformMatrix, type JscadOperation } from "jscad-planner"
import { Box3, Matrix4, Vector3 } from "three"
import type { z } from "zod"
import type { PrimitiveComponent } from "../../base-components/PrimitiveComponent"
import {
  getCachedEnclosureCadModelBounds,
  getEnclosureCadModelBody,
} from "../get-enclosure-cad-model-body"

export interface ResolvedEnclosureComponentBody extends EnclosureComponentBody {
  /** Board-relative XYZ mm, Z=0 at the PCB midplane. */
  bounds?: CadModelBounds
  /** Same native->board placement as bounds; no enclosure transform yet. */
  solid?: FdmComponentSolid
}

/**
 * Right-handed board-relative XYZ, Z-up mm, with Z=0 at the PCB midplane.
 * One native->board matrix places both actual solids and their envelope.
 * Enclosure placement and collision policy belong to create-fdm-enclosure.
 */
export const getComponentBody = ({
  owner,
  pcbComponent,
  cadComponent,
  boardSurfaceZ,
  boardCenter = { x: 0, y: 0 },
}: {
  owner?: PrimitiveComponent | null
  pcbComponent: PcbComponent
  cadComponent: CadComponent | null | undefined
  /** Board-surface POINT in Circuit JSON world Z, not an outward distance. */
  boardSurfaceZ: number
  /** Board-center POINT in Circuit JSON world XY, in mm. */
  boardCenter?: { x: number; y: number }
}): ResolvedEnclosureComponentBody => {
  const footprint = { width: pcbComponent.width, height: pcbComponent.height }
  if (!cadComponent) return { footprint }

  const cadModelProp = owner?._parsedProps?.cadModel
  const authoredModel: z.output<typeof cadModelBase> | undefined =
    cadModelProp &&
    typeof cadModelProp === "object" &&
    !("type" in cadModelProp)
      ? cadModelProp
      : undefined
  const nativeBody = getEnclosureCadModelBody(owner, cadComponent)
  const size = cadComponent.size ?? authoredModel?.size
  const normal = cadComponent.model_board_normal_direction ?? "z+"
  const normalAxis = normal[0] as "x" | "y" | "z"
  let nativeBounds: CadModelBounds | undefined =
    nativeBody?.bounds ??
    (owner
      ? getCachedEnclosureCadModelBounds(owner, cadComponent)
      : undefined) ??
    authoredModel?.modelBounds
  if (!nativeBounds && size) {
    // Size-only assets supply a conservative envelope, never an exact solid.
    const unitScale = cadComponent.model_unit_to_mm_scale_factor ?? 1
    const extent = {
      x: size.x / unitScale,
      y: size.y / unitScale,
      z: size.z / unitScale,
    }
    nativeBounds = {
      min: { x: -extent.x / 2, y: -extent.y / 2, z: -extent.z / 2 },
      max: { x: extent.x / 2, y: extent.y / 2, z: extent.z / 2 },
    }
    const origin = cadComponent.model_origin_position?.[normalAxis] ?? 0
    nativeBounds.min[normalAxis] = normal.endsWith("-")
      ? origin - extent[normalAxis]
      : origin
    nativeBounds.max[normalAxis] = normal.endsWith("-")
      ? origin
      : origin + extent[normalAxis]
  }
  if (!nativeBounds) return { footprint }

  const contactPoint = nativeBody?.boardContactPoint ?? {
    x: (nativeBounds.min.x + nativeBounds.max.x) / 2,
    y: (nativeBounds.min.y + nativeBounds.max.y) / 2,
    z: (nativeBounds.min.z + nativeBounds.max.z) / 2,
  }
  if (!nativeBody?.boardContactPoint) {
    contactPoint[normalAxis] = normal.endsWith("-")
      ? nativeBounds.max[normalAxis]
      : nativeBounds.min[normalAxis]
    if (nativeBody && !cadComponent.model_origin_position) {
      // Match the renderer adapters: the board datum is the contact patch,
      // not the center of an overhanging body. Procedural models provide their
      // own datum above, so through-hole pin tips do not become the board plane.
      const axis = { x: 0, y: 1, z: 2 }[normalAxis]
      const tolerance = Math.max(
        1e-6,
        (nativeBounds.max[normalAxis] - nativeBounds.min[normalAxis]) * 1e-5,
      )
      const min = jscad.maths.vec3.fromValues(Infinity, Infinity, Infinity)
      const max = jscad.maths.vec3.fromValues(-Infinity, -Infinity, -Infinity)
      for (const solid of nativeBody.solids) {
        for (const polygon of jscad.geometries.geom3.toPolygons(solid)) {
          for (const point of polygon.vertices) {
            if (Math.abs(point[axis]! - contactPoint[normalAxis]) > tolerance)
              continue
            jscad.maths.vec3.min(min, min, point)
            jscad.maths.vec3.max(max, max, point)
          }
        }
      }
      if (![...min, ...max].every(Number.isFinite)) {
        throw new Error(
          `${cadComponent.cad_component_id}: could not measure the board contact patch`,
        )
      }
      const center = jscad.maths.vec3.lerp(
        jscad.maths.vec3.create(),
        min,
        max,
        0.5,
      )
      contactPoint.x = center[0]
      contactPoint.y = center[1]
      contactPoint.z = center[2]
    }
  }
  const placement = getCadModelPlacement(
    {
      ...cadComponent,
      size,
      // An unloaded asset has no measurable contact patch. Use the explicit
      // conservative-envelope alignment instead of inventing a contact datum.
      model_origin_alignment:
        !nativeBody &&
        !cadComponent.model_origin_position &&
        cadComponent.model_origin_alignment ===
          "center_of_component_on_board_surface"
          ? "bottom_center_of_component"
          : cadComponent.model_origin_alignment,
    },
    {
      nativeBounds,
      nativeToCanonicalModel: mat4.create(),
      boardContactPoint: nativeBody ? contactPoint : undefined,
      sizeSpace: "native",
      boardToWorld: mat4.fromTranslation(new Float64Array(16), [
        boardCenter.x,
        boardCenter.y,
        0,
      ]),
    },
  )
  if (!placement.nativeToBoard) {
    throw new Error(
      `${cadComponent.cad_component_id}: CAD placement did not resolve the supplied board frame`,
    )
  }
  const matrix = Array.from(placement.nativeToBoard)
  assertTransformMatrix(matrix)
  let bounds: CadModelBounds
  if (nativeBody) {
    const [min, max] = jscad.measurements.measureAggregateBoundingBox(
      nativeBody.solids.map((solid) =>
        jscad.transforms.transform(matrix, solid),
      ),
    )
    bounds = {
      min: { x: min[0], y: min[1], z: min[2] },
      max: { x: max[0], y: max[1], z: max[2] },
    }
  } else {
    // Measure the native envelope in board space directly: rounded world bounds
    // can lose small dimensions when the board is far from the world origin.
    const box = new Box3(
      new Vector3(nativeBounds.min.x, nativeBounds.min.y, nativeBounds.min.z),
      new Vector3(nativeBounds.max.x, nativeBounds.max.y, nativeBounds.max.z),
    ).applyMatrix4(new Matrix4().fromArray(matrix))
    bounds = {
      min: { x: box.min.x, y: box.min.y, z: box.min.z },
      max: { x: box.max.x, y: box.max.y, z: box.max.z },
    }
  }
  const nativePlans: JscadOperation[] | undefined = nativeBody?.solids.map(
    (solid) => ({
      type: "createGeom3",
      polygons: jscad.geometries.geom3.toPolygons(solid),
    }),
  )
  return {
    bounds,
    solid: nativePlans
      ? {
          type: "jscad",
          jscadPlan: {
            type: "transform",
            matrix,
            shape:
              nativePlans.length === 1
                ? nativePlans[0]!
                : { type: "union", shapes: nativePlans },
          },
        }
      : undefined,
    size: {
      x: bounds.max.x - bounds.min.x,
      y: bounds.max.y - bounds.min.y,
      z: bounds.max.z - bounds.min.z,
    },
    aboveBoardHeight: Math.max(
      0,
      pcbComponent.layer === "bottom"
        ? boardSurfaceZ - bounds.min.z
        : bounds.max.z - boardSurfaceZ,
    ),
    rotation: 0,
    footprint,
  }
}
