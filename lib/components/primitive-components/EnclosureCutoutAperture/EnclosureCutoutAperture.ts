import type { EnclosureApertureInput } from "@tscircuit/create-fdm-enclosure"
import { enclosureCutoutApertureProps } from "@tscircuit/props"
import type {
  SourceCircleCutoutAperture,
  SourcePillCutoutAperture,
  SourceRectCutoutAperture,
} from "circuit-json"
import { PrimitiveComponent } from "../../base-components/PrimitiveComponent"
import {
  type GetFdmEnclosureSolverInputParams,
  getFdmEnclosureSolverInput,
} from "./get-fdm-enclosure-solver-input"

/**
 * Metadata consumed by enclosure generators. The aperture itself does not emit
 * Circuit JSON; its nearest ancestor with a pcb_component determines where the
 * enclosure opening is placed.
 */
export class EnclosureCutoutAperture extends PrimitiveComponent<
  typeof enclosureCutoutApertureProps
> {
  source_cutout_aperture_id: string | null = null

  get config() {
    return {
      componentName: "EnclosureCutoutAperture",
      zodProps: enclosureCutoutApertureProps,
    }
  }

  getFdmEnclosureSolverInput(
    params: GetFdmEnclosureSolverInputParams,
  ): EnclosureApertureInput {
    return getFdmEnclosureSolverInput(this, params)
  }

  override doInitialAssignNameToUnnamedComponents(): void {}

  doInitialSourceParentAttachment(): void {
    const owner = this.getParentNormalComponent()
    if (!owner?.source_component_id) {
      throw new Error(
        "<enclosure.cutoutaperture /> must be nested inside a source component",
      )
    }

    const aperture = this._parsedProps
    const common = {
      source_component_id: owner.source_component_id,
      margin: aperture.margin,
      width_dimension_offset: aperture.widthDimensionOffset,
      height_dimension_offset: aperture.heightDimensionOffset,
      depth: aperture.depth,
    }
    let sourceCutoutAperture: { source_cutout_aperture_id: string }
    if (aperture.shape === "circle") {
      const sourceCircleAperture: Omit<
        SourceCircleCutoutAperture,
        "type" | "source_cutout_aperture_id"
      > = {
        ...common,
        shape: "circle",
        radius: aperture.radius,
      }
      sourceCutoutAperture =
        this.root!.db.source_cutout_aperture.insert(sourceCircleAperture)
    } else if (aperture.shape === "pill") {
      const sourcePillAperture: Omit<
        SourcePillCutoutAperture,
        "type" | "source_cutout_aperture_id"
      > = {
        ...common,
        shape: "pill",
        width: aperture.width,
        height: aperture.height,
      }
      sourceCutoutAperture =
        this.root!.db.source_cutout_aperture.insert(sourcePillAperture)
    } else {
      const sourceRectAperture: Omit<
        SourceRectCutoutAperture,
        "type" | "source_cutout_aperture_id"
      > = {
        ...common,
        shape: "rect",
        width: aperture.width,
        height: aperture.height,
      }
      sourceCutoutAperture =
        this.root!.db.source_cutout_aperture.insert(sourceRectAperture)
    }
    this.source_cutout_aperture_id =
      sourceCutoutAperture.source_cutout_aperture_id
  }
}
