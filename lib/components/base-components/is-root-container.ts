/**
 * A root container is a product-level wrapper (today only `<assembly.device>`)
 * that may sit above a `<board>` without being an electrical group or
 * subcircuit. Components that would otherwise assume "my parent is a
 * subcircuit" use this to opt out.
 */
export interface RootContainer {
  isRootContainer: true
}

export const isRootContainer = (
  component: unknown,
): component is RootContainer =>
  typeof component === "object" &&
  component !== null &&
  "isRootContainer" in component &&
  (component as { isRootContainer?: unknown }).isRootContainer === true
