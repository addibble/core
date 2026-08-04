import { expect, test } from "bun:test"
import { enclosure } from "lib"
import { getTestFixture } from "tests/fixtures/get-test-fixture"

test("an enclosure outside assembly.device gets an implicit source assembly", () => {
  const { circuit } = getTestFixture()
  circuit.add(
    <group>
      <board name="B1" width="20mm" height="10mm" />
      <enclosure.fdm.box boardRef=".B1" />
    </group>,
  )
  circuit.render()

  expect(circuit.db.source_assembly_device.list()).toHaveLength(1)
  expect(circuit.db.source_fdm_enclosure.list()).toHaveLength(1)
})
