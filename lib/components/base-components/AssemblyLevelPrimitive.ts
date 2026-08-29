import type { z } from "zod"
import { PrimitiveComponent } from "./PrimitiveComponent/PrimitiveComponent"

/**
 * Base for elements that may be declared directly under `<assembly.device>`,
 * above any board.
 *
 * The default `doInitialAssignNameToUnnamedComponents` reaches for
 * `getSubcircuit()`, which throws "Component is not inside an opaque group (no
 * board?)" when nothing above the element is a board. That assumption is what
 * `isAssemblyDeviceContainer` exists to let a component opt out of, and it is
 * why `AssemblyDevice` overrides the phase to a no-op.
 *
 * Opting out costs nothing here. The phase exists to give an unnamed component
 * a fallback (`unnamed_resistor1`) so selectors and error messages have
 * something to say; it is not where reference designators come from. These
 * elements emit no Circuit JSON and nothing selects an unnamed one, so they
 * need no fallback -- and an author who wants to name a bolt still can, since
 * an authored `name` never went through this phase.
 */
export abstract class AssemblyLevelPrimitive<
  ZodProps extends z.ZodTypeAny = z.ZodTypeAny,
> extends PrimitiveComponent<ZodProps> {
  override doInitialAssignNameToUnnamedComponents(): void {}
}
