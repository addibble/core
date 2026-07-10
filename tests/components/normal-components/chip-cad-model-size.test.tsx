import { expect, test } from "bun:test"
import { getTestFixture } from "tests/fixtures/get-test-fixture"

test("chip serializes cadModel size", () => {
  const { circuit } = getTestFixture()

  circuit.add(
    <board width="10mm" height="10mm">
      <chip
        name="U1"
        footprint="soic8"
        cadModel={{
          objUrl: "https://example.com/chip.obj",
          size: { x: 7, y: 19, z: 6 },
        }}
      />
    </board>,
  )

  circuit.render()

  expect(circuit.db.cad_component.list()[0].size).toEqual({
    x: 7,
    y: 19,
    z: 6,
  })
})
