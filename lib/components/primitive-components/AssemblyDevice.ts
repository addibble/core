import { assemblyDeviceProps } from "@tscircuit/props"
import { type Matrix, identity } from "transformation-matrix"
import type { z } from "zod"
import type { AssemblyDeviceContainer } from "../base-components/is-assembly-device-container"
import { PrimitiveComponent } from "../base-components/PrimitiveComponent"
import { resolveAssemblyModel } from "./resolve-assembly-model"
import { renderAssemblyCadModel } from "./render-assembly-cad-model"

/**
 * Generic over its props schema for the same reason `Group` is: a subclass such
 * as `AssemblyScreen` is still a device, but parses a narrower schema, and an
 * override cannot widen `config.zodProps`.
 */
export class AssemblyDevice<
    Props extends z.ZodType<any, any, any> = typeof assemblyDeviceProps,
  >
  extends PrimitiveComponent<Props>
  implements AssemblyDeviceContainer
{
  isAssemblyDeviceContainer = true as const

  get config() {
    return {
      componentName: "AssemblyDevice",
      zodProps: assemblyDeviceProps as unknown as Props,
    }
  }

  override doInitialAssignNameToUnnamedComponents(): void {}

  override computeSchematicGlobalTransform(): Matrix {
    return identity()
  }

  override _computePcbGlobalTransformBeforeLayout(): Matrix {
    return identity()
  }

  doInitialSourceRender(): void {
    // Model-less devices remain transparent containers with no source record.
    if (
      (this._parsedProps.modelUrl === undefined &&
        this._parsedProps.model === undefined &&
        this._parsedProps.cadModel == null) ||
      !this.root
    )
      return
    this.source_component_id = this.root.db.source_component.insert({
      ftype: "simple_chip",
      name: this.name,
    }).source_component_id
  }

  doInitialCadModelRender(): void {
    const model =
      resolveAssemblyModel(this._parsedProps) ?? this._parsedProps.cadModel
    if (
      !this.root ||
      this.root.pcbDisabled ||
      !this.source_component_id ||
      !model
    )
      return
    // Devices retain their world frame: right-handed, +X right, +Y top,
    // +Z above; the origin is a point in millimetres, independent of children.
    this.cad_component_id = renderAssemblyCadModel(this, model, {
      position: { x: 0, y: 0, z: 0 },
      pcbRotation: 0,
      layer: "top",
    })
  }
}
