import { assemblyScreenProps } from "@tscircuit/props"
import { AssemblyDevice } from "./AssemblyDevice"
import { AssemblyScreen_doInitialCadModelRender } from "./AssemblyScreen_doInitialCadModelRender"

/**
 * A display module fitted into the device.
 *
 * A screen is a semantic assembly-device container, while retaining its
 * connector-relative placement and model rendering behavior.
 */
export class AssemblyScreen extends AssemblyDevice<typeof assemblyScreenProps> {
  get config() {
    return {
      componentName: "AssemblyScreen",
      zodProps: assemblyScreenProps,
    }
  }

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

  getConnectorSelector(): string | null {
    return this._parsedProps.connectsTo ?? null
  }
}
