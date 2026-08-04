import { assemblyDeviceProps } from "@tscircuit/props"
import { type Matrix, identity } from "transformation-matrix"
import type { RootContainer } from "../base-components/is-root-container"
import { PrimitiveComponent } from "../base-components/PrimitiveComponent"

export class AssemblyDevice
  extends PrimitiveComponent<typeof assemblyDeviceProps>
  implements RootContainer
{
  source_assembly_device_id: string | null = null
  isRootContainer = true as const

  get config() {
    return {
      componentName: "AssemblyDevice",
      zodProps: assemblyDeviceProps,
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
    const sourceAssemblyDevice = this.root!.db.source_assembly_device.insert({
      name: this._parsedProps.name,
    })
    this.source_assembly_device_id =
      sourceAssemblyDevice.source_assembly_device_id
  }
}
