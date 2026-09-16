import type { z } from "zod"
import { PrimitiveComponent } from "./PrimitiveComponent/PrimitiveComponent"

export abstract class AssemblyLevelPrimitive<
  ZodProps extends z.ZodTypeAny = z.ZodTypeAny,
> extends PrimitiveComponent<ZodProps> {
  // Skip automatic naming's subcircuit lookup: these elements may have no board.
  override doInitialAssignNameToUnnamedComponents(): void {}
}
