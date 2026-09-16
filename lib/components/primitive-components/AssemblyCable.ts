import { assemblyCableProps } from "@tscircuit/props"
import { AssemblyLevelPrimitive } from "../base-components/AssemblyLevelPrimitive"

export class AssemblyCable extends AssemblyLevelPrimitive<
  typeof assemblyCableProps
> {
  get config() {
    return {
      componentName: "AssemblyCable",
      zodProps: assemblyCableProps,
    }
  }

  getEndpointSelectors(): string[] {
    const { connectsTo } = this._parsedProps
    return typeof connectsTo === "string" ? [connectsTo] : [...connectsTo]
  }
}
