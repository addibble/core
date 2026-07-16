import { z } from "zod"
import { PrimitiveComponent } from "../base-components/PrimitiveComponent"
import type { ISubcircuit } from "./Group/Subcircuit/ISubcircuit"

const externalReactElementProps = z.object({}).passthrough()

export class ExternalReactElement extends PrimitiveComponent<
  typeof externalReactElementProps
> {
  externalReactElementType: string
  isRootContainer: boolean

  get config() {
    return {
      componentName: "ExternalReactElement",
      zodProps: externalReactElementProps,
    }
  }

  constructor(
    type: string,
    props: Record<string, unknown>,
    options: { isRootContainer?: boolean } = {},
  ) {
    super(props)
    this.externalReactElementType = type
    this.isRootContainer = options.isRootContainer ?? false
  }

  override getSubcircuit(): ISubcircuit {
    if (this.isRootContainer) return this as unknown as ISubcircuit
    return super.getSubcircuit()
  }

  // External metadata nodes do not participate in component naming.
  override doInitialAssignNameToUnnamedComponents() {}
}
