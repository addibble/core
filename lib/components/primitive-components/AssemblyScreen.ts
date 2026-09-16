import { assemblyScreenProps } from "@tscircuit/props"
import { AssemblyDeviceBase } from "./AssemblyDevice"

export class AssemblyScreen extends AssemblyDeviceBase<
  typeof assemblyScreenProps
> {
  get config() {
    return {
      componentName: "AssemblyScreen",
      zodProps: assemblyScreenProps,
    }
  }

  getConnectorSelector(): string | null {
    return this._parsedProps.connectsTo
  }
}
