import { assemblyScreenProps } from "@tscircuit/props"
import { AssemblyDevice } from "./AssemblyDevice"

/**
 * A display module fitted into the device.
 *
 * **A screen is a kind of device, not a leaf beside one.** It is a subassembly
 * somebody else manufactured: it has its own parts, its own model, and it
 * nests. Extending `AssemblyDevice` is what makes that true structurally rather
 * than by convention -- a screen inherits `isAssemblyDeviceContainer`, so every
 * place that already reasons about devices (selectors, the transparent
 * transform, name assignment) treats a screen as one without being told.
 *
 * It adds only what a generic device cannot express: which connector it plugs
 * into, and its active area.
 */
export class AssemblyScreen extends AssemblyDevice {
  get config() {
    return {
      componentName: "AssemblyScreen",
      zodProps: assemblyScreenProps,
    }
  }

  /**
   * The connector this screen plugs into, as a selector.
   *
   * This is also where an inferred `assembly.cable` gets one of its endpoints,
   * which is why a screen needs no cable element to have a cable.
   */
  getConnectorSelector(): string | null {
    return (this._parsedProps as { connectsTo?: string }).connectsTo ?? null
  }
}
