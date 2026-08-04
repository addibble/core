import type { SourceCutoutAperture } from "circuit-json"
import { NormalComponent } from "lib/components/base-components/NormalComponent"
import type { PrimitiveComponent } from "lib/components/base-components/PrimitiveComponent"
import { EnclosureCutoutAperture } from "lib/components/primitive-components/EnclosureCutoutAperture"
import type { InflatorContext } from "../InflatorFn"

export const inflateSourceCutoutApertures = ({
  injectionDb,
  subcircuit,
  groupsMap,
}: InflatorContext): void => {
  for (const aperture of injectionDb.source_cutout_aperture.list()) {
    const sourceOwner = injectionDb.source_component.get(
      aperture.source_component_id,
    )
    if (!sourceOwner) {
      throw new Error(
        `Cannot inflate ${aperture.source_cutout_aperture_id}: source component ${aperture.source_component_id} does not exist`,
      )
    }

    const ownerRoot =
      (sourceOwner.source_group_id
        ? groupsMap?.get(sourceOwner.source_group_id)
        : undefined) ?? subcircuit
    const ownerRootComponent = ownerRoot as PrimitiveComponent
    const owner = [
      ownerRootComponent,
      ...ownerRootComponent.getDescendants(),
    ].find(
      (component): component is NormalComponent =>
        component instanceof NormalComponent &&
        component.name === sourceOwner.name,
    )
    if (!owner) {
      throw new Error(
        `Cannot inflate ${aperture.source_cutout_aperture_id}: source component ${aperture.source_component_id} was not inflated`,
      )
    }

    owner.add(
      new EnclosureCutoutAperture(toEnclosureCutoutApertureProps(aperture)),
    )
  }
}

const toEnclosureCutoutApertureProps = (aperture: SourceCutoutAperture) => {
  const common = {
    shape: aperture.shape,
    margin: aperture.margin,
    widthDimensionOffset: aperture.width_dimension_offset,
    heightDimensionOffset: aperture.height_dimension_offset,
    depth: aperture.depth,
  }
  if (aperture.shape === "circle") {
    return {
      ...common,
      shape: "circle" as const,
      radius: aperture.radius,
    }
  }
  return {
    ...common,
    shape: aperture.shape,
    width: aperture.width,
    height: aperture.height,
  }
}
