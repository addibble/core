import { assemblyScrewProps } from "@tscircuit/props"
import { AssemblyLevelPrimitive } from "../base-components/AssemblyLevelPrimitive"

/** Self-tapping into plastic, unlike AssemblyBolt's insert-backed mount. */
export class AssemblyScrew extends AssemblyLevelPrimitive<
  typeof assemblyScrewProps
> {
  get config() {
    return {
      componentName: "AssemblyScrew",
      zodProps: assemblyScrewProps,
    }
  }

  getHoleSelector(): string | null {
    return this._parsedProps.holeRef ?? null
  }
}
