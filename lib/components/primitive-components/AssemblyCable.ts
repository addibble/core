import { assemblyCableProps } from "@tscircuit/props"
import { AssemblyLevelPrimitive } from "../base-components/AssemblyLevelPrimitive"

/**
 * A cable in the device assembly.
 *
 * A cable has two ends, so `connectsTo` carries at most two selectors; one
 * endpoint describes a cable whose far end the design does not model. The
 * schema enforces the count, so consumers can rely on it.
 */
export class AssemblyCable extends AssemblyLevelPrimitive<
  typeof assemblyCableProps
> {
  get config() {
    return {
      componentName: "AssemblyCable",
      zodProps: assemblyCableProps,
    }
  }

  /** Endpoints as an array, whichever spelling the author used. */
  getEndpointSelectors(): string[] {
    const { connectsTo } = this._parsedProps
    return typeof connectsTo === "string" ? [connectsTo] : [...connectsTo]
  }
}
