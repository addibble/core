import { enclosureFdmHeatsetInsertProps } from "@tscircuit/props"
import { AssemblyLevelPrimitive } from "../base-components/AssemblyLevelPrimitive"

/** Mount metadata; the enclosure generator emits the insert's Circuit JSON. */
export class EnclosureFdmHeatsetInsert extends AssemblyLevelPrimitive<
  typeof enclosureFdmHeatsetInsertProps
> {
  get config() {
    return {
      componentName: "EnclosureFdmHeatsetInsert",
      zodProps: enclosureFdmHeatsetInsertProps,
    }
  }

  getHoleSelector(): string | null {
    return this._parsedProps.holeRef ?? null
  }
}
