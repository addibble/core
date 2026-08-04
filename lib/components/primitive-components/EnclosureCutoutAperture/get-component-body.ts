import type { EnclosureComponentBody } from "@tscircuit/create-fdm-enclosure"
import type { CadComponent, PcbComponent } from "circuit-json"
import type { PrimitiveComponent } from "../../base-components/PrimitiveComponent"

const toMm = (value: number | string | undefined): number | undefined => {
  if (typeof value === "number") return value
  if (typeof value !== "string") return undefined
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

type Point3Like = { x?: unknown; y?: unknown; z?: unknown }

/**
 * How far the model reaches beyond the point that sits on the board surface.
 *
 * `model_origin_position` is that point, and `model_bounds` is the model's
 * extent in the same frame, so the difference along the board normal is the
 * reach. `size` cannot answer this: it carries the extent but not where the box
 * sits relative to the origin, and the box is generally not centered on it.
 *
 * Everything that merely *translates* the model -- `zOffsetFromSurface`,
 * `positionOffset.z`, the mounting layer -- is already composed into
 * `cad_component.position.z`, so the caller adds that rather than re-deriving
 * it here.
 */
const getModelReachAboveOrigin = (cad: CadComponent): number | undefined => {
  const bounds = cad.model_bounds as
    | { min?: Point3Like; max?: Point3Like }
    | undefined
  const origin = cad.model_origin_position as Point3Like | undefined
  if (!bounds?.min || !bounds?.max || !origin) return undefined

  // The model axis that leaves the board. Defaults to z+, matching the
  // renderer's own default in `getOrientationRotationForBoardNormal`.
  const normal = cad.model_board_normal_direction ?? "z+"
  const axis = normal[0] as "x" | "y" | "z"
  if (axis !== "x" && axis !== "y" && axis !== "z") return undefined

  const min = toMm(bounds.min[axis] as number | string | undefined)
  const max = toMm(bounds.max[axis] as number | string | undefined)
  const at = toMm(origin[axis] as number | string | undefined)
  if (min === undefined || max === undefined || at === undefined)
    return undefined

  // For a negative normal the model points the other way, so the reach runs
  // from the origin down to the minimum instead of up to the maximum.
  const reach = normal.endsWith("-") ? at - min : max - at
  return Number.isFinite(reach) && reach >= 0 ? reach : undefined
}

/**
 * Project the part's physical facts into the enclosure package's normalized
 * body envelope.
 *
 * Read from the emitted `cad_component`, not from `cadModel` props. The record
 * is the normalized form every authoring path converges on -- an object prop, a
 * `<cadmodel>` child, a footprinter string, an async-resolved model, or a
 * subcircuit inflated back from Circuit JSON -- so reading props directly
 * yielded no body at all for most of them, and the aperture quietly fell back to
 * footprint dimensions.
 *
 * It also means the rotation and the Z datum are the ones the model is actually
 * rendered at: `rotation.z` already composes the footprint rotation with the
 * model's own `pcbRotationOffset`, and `position.z` already composes
 * `zOffsetFromSurface`, `positionOffset.z` and the mounting layer. Re-deriving
 * either here is how the two drift apart.
 *
 * Core reports what it canonically knows and does not decide what any of it
 * means for a cut: face selection and depth projection are enclosure policy,
 * which is why no face is taken here.
 */
export const getComponentBody = ({
  pcbComponent,
  cadComponent,
  boardSurfaceZ,
}: {
  owner?: PrimitiveComponent | null
  pcbComponent: PcbComponent
  cadComponent: CadComponent | null | undefined
  /**
   * World Z of the surface the part is mounted on, so the model's reach is
   * measured from the board rather than from wherever its origin landed.
   */
  boardSurfaceZ: number
}): EnclosureComponentBody => {
  const size = cadComponent?.size
  const x = toMm(size?.x as number | string | undefined)
  const y = toMm(size?.y as number | string | undefined)
  const z = toMm(size?.z as number | string | undefined)
  const reach = cadComponent
    ? getModelReachAboveOrigin(cadComponent)
    : undefined
  const originZ = toMm(cadComponent?.position?.z as number | undefined)
  const aboveBoardHeight =
    reach !== undefined && originZ !== undefined
      ? reach + Math.abs(originZ - boardSurfaceZ)
      : undefined

  return {
    size: x !== undefined && y !== undefined ? { x, y, z } : undefined,
    aboveBoardHeight,
    rotation:
      toMm(cadComponent?.rotation?.z as number | undefined) ??
      pcbComponent.rotation ??
      0,
    footprint: {
      width: pcbComponent.width,
      height: pcbComponent.height,
    },
  }
}
