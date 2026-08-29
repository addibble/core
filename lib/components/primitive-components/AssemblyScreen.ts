import { assemblyScreenProps } from "@tscircuit/props"
import { PrimitiveComponent } from "../base-components/PrimitiveComponent"
import type { AssemblyDeviceContainer } from "../base-components/is-assembly-device-container"
import { AssemblyScreen_doInitialCadModelRender } from "./AssemblyScreen_doInitialCadModelRender"

export class AssemblyScreen
  extends PrimitiveComponent<typeof assemblyScreenProps>
  implements AssemblyDeviceContainer
{
  isAssemblyDeviceContainer = true as const

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
  override doInitialAssignNameToUnnamedComponents(): void {
    if (this._parsedProps.name) return
    throw new Error("assembly.screen requires a non-empty name")
  }

  doInitialSourceRender(): void {
    const sourceComponent = this.root!.db.source_component.insert({
      ftype: "simple_chip",
      name: this.name,
    })
    this.source_component_id = sourceComponent.source_component_id
  }

  doInitialCadModelRender(): void {
    AssemblyScreen_doInitialCadModelRender(this)
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
