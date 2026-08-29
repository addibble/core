import { assemblyScrewProps } from "@tscircuit/props"
import { AssemblyLevelPrimitive } from "../base-components/AssemblyLevelPrimitive"

/**
 * A self-tapping screw driven straight into a printed boss.
 *
 * The element *is* the fastening method: a screw threads into the plastic,
 * where a bolt threads into an insert, and that decides what is bored into the
 * boss (a self-tap pilot rather than an insert's installation diameter). No
 * flag can contradict the hardware present, because there is no flag.
 *
 * Carries no length. The stack decides it, and `create-fdm-enclosure` rounds
 * the result up to a stocked size.
 */
export class AssemblyScrew extends AssemblyLevelPrimitive<
  typeof assemblyScrewProps
> {
  get config() {
    return {
      componentName: "AssemblyScrew",
      zodProps: assemblyScrewProps,
    }
  }

  /**
   * The hole this screw goes into, as a selector.
   *
   * Null when the element is nested in its hole, in which case the parent is
   * the answer and no selector is needed.
   */
  getHoleSelector(): string | null {
    return this._parsedProps.holeRef ?? null
  }

  /**
   * What to buy, in a supplier catalogue's terms.
   *
   * A procurement query for the parts engine -- never parsed by the render, and
   * never a BOM group key, since two authors describe one screw two ways.
   */
  getDesignation(): string | null {
    return this._parsedProps.designation ?? null
  }
}
