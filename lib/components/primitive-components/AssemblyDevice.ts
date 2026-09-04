import { assemblyDeviceProps } from "@tscircuit/props"
import { type Matrix, identity } from "transformation-matrix"
import type { z } from "zod"
import type { AssemblyDeviceContainer } from "../base-components/is-assembly-device-container"
import { PrimitiveComponent } from "../base-components/PrimitiveComponent"

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

  // Compatibility stage: this is a transparent product-level container and emits no
  // Circuit JSON. The later schema migration adds source_assembly_device without
  // changing the authoring element or its assembly-container semantics.
}
