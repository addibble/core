import { expect, test } from "bun:test"
import { assembly, enclosure } from "lib"
import { any_circuit_element } from "circuit-json"
import { getTestFixture } from "tests/fixtures/get-test-fixture"

/**
 * Core is the integration boundary that assembles source ownership, part role,
 * placement and JSCAD geometry. Hand-written schema fixtures cannot catch a
 * required field omitted here, as happened in the standalone preview path.
 */
test("every emitted enclosure part parses as canonical Circuit JSON", () => {
  const { circuit } = getTestFixture()
  circuit.add(
    <assembly.device name="parse-probe">
      <board name="B1" width="30mm" height="20mm" routingDisabled />
      <enclosure.fdm.box name="E1" boardRef=".B1" />
    </assembly.device>,
  )
  circuit.render()

  const enclosureParts = circuit.db.cad_fdm_enclosure.list()
  expect(enclosureParts).toHaveLength(2)
  expect(enclosureParts.map((part) => part.enclosure_part).sort()).toEqual([
    "base",
    "lid",
  ])
  for (const enclosurePart of enclosureParts) {
    expect(() => any_circuit_element.parse(enclosurePart)).not.toThrow()
  }
})
