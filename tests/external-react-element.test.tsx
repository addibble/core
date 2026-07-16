import { expect, test } from "bun:test"
import {
  Circuit,
  registerExternalReactElement,
  unregisterExternalReactElement,
} from "lib/index"
import React from "react"

test("registered external React elements retain ownership without Circuit JSON output", () => {
  registerExternalReactElement("example.metadata", {
    parseProps(props) {
      return props as Record<string, unknown>
    },
  })
  try {
    const circuit = new Circuit()
    circuit.add(
      <chip name="U1" footprint="soic8">
        {React.createElement("example.metadata", { role: "test" })}
      </chip>,
    )
    circuit.render()

    const chip = circuit.firstChild?.children.find(
      (child) => child.componentName === "Chip",
    )
    const external = chip?.children.find(
      (child) =>
        "externalReactElementType" in child &&
        child.externalReactElementType === "example.metadata",
    )
    expect(external?.parent).toBe(chip)
    expect(
      circuit
        .getCircuitJson()
        .some((element) => element.type.includes("metadata")),
    ).toBe(false)
  } finally {
    unregisterExternalReactElement("example.metadata")
  }
})

test("an external root container avoids implicit electrical group semantics", () => {
  registerExternalReactElement("example.assembly", {
    parseProps(props) {
      const { children: _children, ...parsedProps } = props as Record<
        string,
        unknown
      >
      return parsedProps
    },
    isRootContainer: true,
  })
  registerExternalReactElement("example.spec", {
    parseProps(props) {
      return props as Record<string, unknown>
    },
  })
  try {
    const circuit = new Circuit()
    circuit.add(
      React.createElement(
        "example.assembly",
        null,
        <board name="B1" width="20mm" height="10mm" />,
        React.createElement("example.spec"),
      ),
    )
    circuit.render()

    expect(
      "externalReactElementType" in circuit.firstChild! &&
        circuit.firstChild.externalReactElementType,
    ).toBe("example.assembly")
    expect(
      circuit
        .getCircuitJson()
        .filter((element) => element.type === "source_group"),
    ).toHaveLength(1)
    expect(
      circuit.getCircuitJson().some((element) => element.type === "pcb_group"),
    ).toBe(false)
  } finally {
    unregisterExternalReactElement("example.assembly")
    unregisterExternalReactElement("example.spec")
  }
})
