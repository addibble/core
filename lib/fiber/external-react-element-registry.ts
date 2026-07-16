export interface ExternalReactElementRegistration {
  parseProps: (props: unknown) => Record<string, unknown>
  /** Allow this no-output element to serve as the circuit's explicit root. */
  isRootContainer?: boolean
}

const EXTERNAL_REACT_ELEMENT_REGISTRY_SYMBOL = Symbol.for(
  "tscircuit.external-react-element-registry.v1",
)

const getExternalReactElementRegistry = () => {
  const globalWithRegistry = globalThis as typeof globalThis & {
    [EXTERNAL_REACT_ELEMENT_REGISTRY_SYMBOL]?: Map<
      string,
      ExternalReactElementRegistration
    >
  }
  globalWithRegistry[EXTERNAL_REACT_ELEMENT_REGISTRY_SYMBOL] ??= new Map()
  return globalWithRegistry[EXTERNAL_REACT_ELEMENT_REGISTRY_SYMBOL]
}

export const registerExternalReactElement = (
  type: string,
  registration: ExternalReactElementRegistration,
): void => {
  getExternalReactElementRegistry().set(type, registration)
}

export const unregisterExternalReactElement = (type: string): void => {
  getExternalReactElementRegistry().delete(type)
}

export const getExternalReactElementRegistration = (
  type: string,
): ExternalReactElementRegistration | undefined =>
  getExternalReactElementRegistry().get(type)
