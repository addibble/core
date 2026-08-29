import { assemblyBoltProps } from "@tscircuit/props"
import { AssemblyLevelPrimitive } from "../base-components/AssemblyLevelPrimitive"

/**
 * A bolt that fastens the assembly together.
 *
 * A bolt spans parts rather than belonging to one, so it is declared at
 * assembly level and points at the hole it passes through. Like the heat-set
 * insert, it emits no Circuit JSON of its own yet: it is read by the enclosure
 * generator, which knows the material stack the bolt has to cross.
 */
export class AssemblyBolt extends AssemblyLevelPrimitive<
  typeof assemblyBoltProps
> {
  get config() {
    return {
      componentName: "AssemblyBolt",
      zodProps: assemblyBoltProps,
    }
  }

  /** The hole this bolt passes through, as a selector. Always present. */
  getHoleSelector(): string {
    return this._parsedProps.holeRef
  }

  /** True when the bolt reaches through the lid rather than stopping at the board. */
  getFastensLid(): boolean {
    return this._parsedProps.fastensLid ?? false
  }
}
