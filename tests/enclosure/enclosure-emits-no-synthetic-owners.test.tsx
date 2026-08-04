import { expect, test } from "bun:test"
import { enclosure } from "lib"
import { getTestFixture } from "tests/fixtures/get-test-fixture"

/**
 * Generated enclosure parts ship only as typed `cad_fdm_enclosure` records.
 *
 * They used to need a synthetic `source_component` + `pcb_component` +
 * `cad_component` triple, because `cad_component` requires PCB ownership. That
 * forced a zero-size placeholder whose placement and obstruction semantics had
 * to be disabled by hand, put a mechanical part into the electrical component
 * list as a `simple_chip`, and at one point reported a footprint larger than the
 * board it sat on. `cad_fdm_enclosure` needs no PCB owner, so the whole triple
 * is gone.
 */
test("an enclosure emits no synthetic source/pcb/cad component owners", () => {
  const { circuit } = getTestFixture()
  circuit.add(
    <group>
      <board name="B1" width="20mm" height="10mm">
        <chip name="U1" footprint="soic8" />
      </board>
      <enclosure.fdm.box name="EN1" boardRef=".B1" />
    </group>,
  )
  circuit.render()

  // Only the real chip produces electrical/PCB records.
  expect(circuit.db.source_component.list().map((c) => c.name)).toEqual(["U1"])
  expect(
    circuit.db.pcb_component.list().map((c) => c.source_component_id),
  ).toEqual([circuit.db.source_component.list()[0]!.source_component_id])

  // No cad_component carries enclosure geometry.
  expect(
    circuit.db.cad_component.list().filter((cad) => cad.model_jscad),
  ).toHaveLength(0)

  // The enclosure is fully described by its typed records.
  expect(circuit.db.source_fdm_enclosure.list()).toHaveLength(1)
  const typedEnclosure = circuit.db.cad_fdm_enclosure.list()[0]
  expect(typedEnclosure).toMatchObject({
    source_fdm_enclosure_id:
      circuit.db.source_fdm_enclosure.list()[0]!.source_fdm_enclosure_id,
    name: "EN1",
  })
  expect(typedEnclosure!.size!.x).toBeGreaterThan(20)
  expect(typedEnclosure!.size!.y).toBeGreaterThan(10)
  expect(typedEnclosure!.size!.z).toBeGreaterThan(0)
  expect(typedEnclosure!.model_jscad).toBeDefined()
})
