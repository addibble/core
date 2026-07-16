import { expect, test } from "bun:test"
import {
  Circuit,
  registerCircuitJsonPostprocessor,
  unregisterCircuitJsonPostprocessor,
} from "lib/index"

test("registered postprocessors extend canonical Circuit JSON", () => {
  registerCircuitJsonPostprocessor("test-assembly", ({ circuitJson }) => [
    ...circuitJson,
    {
      type: "source_component",
      source_component_id: "source_postprocessed",
      ftype: "simple_chip",
      name: "postprocessed",
    },
  ])
  try {
    const circuit = new Circuit()
    circuit.add(<board name="B1" width="20mm" height="10mm" />)
    circuit.render()

    expect(
      circuit
        .getCircuitJson()
        .find(
          (element) =>
            element.type === "source_component" &&
            element.source_component_id === "source_postprocessed",
        ),
    ).toMatchObject({ name: "postprocessed" })
  } finally {
    unregisterCircuitJsonPostprocessor("test-assembly")
  }
})
