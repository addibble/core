import { expect, test } from "bun:test"
import {
  Circuit,
  registerExternalReactElement,
  unregisterExternalReactElement,
} from "lib/index"
import React from "react"

test("external React elements survive isolated board rendering", async () => {
  registerExternalReactElement("example.aperture", {
    parseProps(props) {
      return props as Record<string, unknown>
    },
  })
  try {
    const circuit = new Circuit()
    circuit.add(
      <board name="B1" width={20} height={20}>
        <subcircuit name="S1" _subcircuitCachingEnabled>
          <chip name="U1" footprint="soic8">
            {React.createElement("example.aperture", { shape: "circle" })}
          </chip>
        </subcircuit>
      </board>,
    )
    await circuit.renderUntilSettled()

    const external = circuit.externalReactElements.find(
      (element) =>
        "externalReactElementType" in element &&
        element.externalReactElementType === "example.aperture",
    )
    expect(external).toBeTruthy()
    expect(external?.root).toBe(circuit)
  } finally {
    unregisterExternalReactElement("example.aperture")
  }
})
