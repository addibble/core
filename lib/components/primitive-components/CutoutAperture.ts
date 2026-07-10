import { cutoutApertureProps } from "@tscircuit/props"
import { underscorifyCutoutAperture } from "lib/soup/underscorifyCutoutAperture"
import { PrimitiveComponent } from "../base-components/PrimitiveComponent"

export class CutoutAperture extends PrimitiveComponent<
  typeof cutoutApertureProps
> {
  get config() {
    return {
      componentName: "CutoutAperture",
      zodProps: cutoutApertureProps,
    }
  }

  doInitialSourceParentAttachment(): void {
    const parent = this.getParentNormalComponent()
    if (!parent?.source_component_id) {
      throw new Error(
        `${this.getString()} must be nested inside a source component`,
      )
    }

    this.root!.db.source_component.update(parent.source_component_id, {
      cutout_aperture: underscorifyCutoutAperture(this._parsedProps),
    })
    this.source_component_id = parent.source_component_id
  }
}
