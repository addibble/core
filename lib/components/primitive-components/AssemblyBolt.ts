import { assemblyBoltProps } from "@tscircuit/props"
import { AssemblyLevelPrimitive } from "../base-components/AssemblyLevelPrimitive"

/** Mount metadata; the enclosure generator emits the hardware's Circuit JSON. */
export class AssemblyBolt extends AssemblyLevelPrimitive<
  typeof assemblyBoltProps
> {
  get config() {
    return {
      componentName: "AssemblyBolt",
      zodProps: assemblyBoltProps,
    }
  }

  getHoleSelector(): string | null {
    return this._parsedProps.holeRef ?? null
  }

  getFastensLid(): boolean {
    return this._parsedProps.fastensLid ?? false
  }
}
