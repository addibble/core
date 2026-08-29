import { enclosureFdmHeatsetInsertProps } from "@tscircuit/props"
import { AssemblyLevelPrimitive } from "../base-components/AssemblyLevelPrimitive"

/**
 * A heat-set insert melted into an enclosure boss.
 *
 * Like `<enclosure.cutoutaperture>`, this is metadata consumed by the enclosure
 * generator rather than a thing that emits its own Circuit JSON. It says a hole
 * is a fastening point and which thread it takes; the enclosure decides what
 * boss and bore that implies.
 *
 * It may be declared as a child of the hole it sits under, or anywhere with a
 * `holeRef` selector naming that hole. `getHoleSelector` resolves the two
 * spellings to one answer so no consumer has to handle both.
 */
export class EnclosureFdmHeatsetInsert extends AssemblyLevelPrimitive<
  typeof enclosureFdmHeatsetInsertProps
> {
  get config() {
    return {
      componentName: "EnclosureFdmHeatsetInsert",
      zodProps: enclosureFdmHeatsetInsertProps,
    }
  }

  /**
   * The hole this insert sits under, as a selector.
   *
   * Returns null when the element is nested in its hole, in which case the
   * parent is the answer and no selector is needed.
   */
  getHoleSelector(): string | null {
    return this._parsedProps.holeRef ?? null
  }
}
