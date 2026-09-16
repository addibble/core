import { assemblyDeviceProps } from "@tscircuit/props"
import { type Matrix, identity } from "transformation-matrix"
import type { z } from "zod"
import type { AssemblyDeviceContainer } from "../base-components/is-assembly-device-container"
import { PrimitiveComponent } from "../base-components/PrimitiveComponent"

export abstract class AssemblyDeviceBase<Props extends z.ZodTypeAny>
  extends PrimitiveComponent<Props>
  implements AssemblyDeviceContainer
{
  isAssemblyDeviceContainer = true as const

  override doInitialAssignNameToUnnamedComponents(): void {}

  override computeSchematicGlobalTransform(): Matrix {
    return identity()
  }

  override _computePcbGlobalTransformBeforeLayout(): Matrix {
    return identity()
  }

  // Compatibility stage: this is a transparent product-level container and emits no
  // Circuit JSON. The later schema migration adds source_assembly_device without
  // changing the authoring element or its assembly-container semantics.
}

export class AssemblyDevice extends AssemblyDeviceBase<
  typeof assemblyDeviceProps
> {
  get config() {
    return {
      componentName: "AssemblyDevice",
      zodProps: assemblyDeviceProps,
    }
  }
}
