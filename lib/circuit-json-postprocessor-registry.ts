import type { AnyCircuitElement } from "circuit-json"
import type { IsolatedCircuit } from "./IsolatedCircuit"

export interface CircuitJsonPostprocessorInput {
  circuit: IsolatedCircuit
  circuitJson: AnyCircuitElement[]
}

export type CircuitJsonPostprocessor = (
  input: CircuitJsonPostprocessorInput,
) => AnyCircuitElement[]

const CIRCUIT_JSON_POSTPROCESSOR_REGISTRY_SYMBOL = Symbol.for(
  "tscircuit.circuit-json-postprocessor-registry.v1",
)

const getCircuitJsonPostprocessorRegistry = () => {
  const globalWithRegistry = globalThis as typeof globalThis & {
    [CIRCUIT_JSON_POSTPROCESSOR_REGISTRY_SYMBOL]?: Map<
      string,
      CircuitJsonPostprocessor
    >
  }
  globalWithRegistry[CIRCUIT_JSON_POSTPROCESSOR_REGISTRY_SYMBOL] ??= new Map()
  return globalWithRegistry[CIRCUIT_JSON_POSTPROCESSOR_REGISTRY_SYMBOL]
}

export const registerCircuitJsonPostprocessor = (
  id: string,
  postprocessor: CircuitJsonPostprocessor,
): void => {
  getCircuitJsonPostprocessorRegistry().set(id, postprocessor)
}

export const unregisterCircuitJsonPostprocessor = (id: string): void => {
  getCircuitJsonPostprocessorRegistry().delete(id)
}

export const getCircuitJsonPostprocessors = (): CircuitJsonPostprocessor[] => [
  ...getCircuitJsonPostprocessorRegistry().values(),
]
