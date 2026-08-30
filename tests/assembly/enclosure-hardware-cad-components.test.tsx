import { expect, test } from "bun:test"
import { assembly, enclosure } from "lib"
import { getTestFixture } from "tests/fixtures/get-test-fixture"

/**
 * Every piece of hardware a solved enclosure consumes becomes its own part.
 *
 * A mount resolves into one piece per part -- a screw alone, or an insert AND
 * the bolt that threads into it -- and each gets a source_component, a
 * zero-size suppressed pcb_component and a cad_component carrying the
 * modelprinter string. The hole carries none of them: one hole holds two
 * pieces, so a single id on the hole could not tell them apart.
 */
test("an enclosure emits a cad_component per piece of mounting hardware", async () => {
  const { circuit } = getTestFixture()

  circuit.add(
    <assembly.device name="DEV1">
      <board name="B1" width="40mm" height="24mm">
        {/* No insert, so the screw forms its own thread in the boss. */}
        <hole name="H1" pcbX={-8} pcbY={0} diameter="3.4mm">
          <assembly.screw thread="m3" />
        </hole>
        {/* A bolt threads into an insert: two pieces on one hole. */}
        <hole name="H2" pcbX={-16} pcbY={-8} diameter="3.4mm">
          <assembly.bolt thread="m3" />
          <enclosure.fdm.heatsetinsert thread="m3" />
        </hole>
      </board>
      <enclosure.fdm.box name="EN1" boardRef=".B1" standoffHeight={8} />
    </assembly.device>,
  )

  const circuitJson = await circuit.getCircuitJson()
  type HardwarePiece = {
    modelprinter_string: string
    position: { x: number; y: number; z: number }
    pcb_component_id: string
    source_component_id: string
  }
  const hardware = circuitJson.filter(
    (element) =>
      element.type === "cad_component" &&
      Boolean(
        (element as { modelprinter_string?: string }).modelprinter_string,
      ),
  ) as unknown as HardwarePiece[]

  // The screw's mount produces one piece; the bolt's mount produces two.
  expect(hardware.map((piece) => piece.modelprinter_string).sort()).toEqual([
    "bolt_m3_l8mm_socketcap",
    "heatsetinsert_m3_l5.7mm",
    "screw_m3_l8mm_socketcap",
  ])

  // The family follows the MOUNT, not the piece: the solver calls both a
  // "screw" because they are the same solid, but what they thread into is what
  // decides the bore, so only the one without an insert stays a screw.
  const bolt = hardware.find((p) => p.modelprinter_string.startsWith("bolt_"))!
  const insert = hardware.find((p) =>
    p.modelprinter_string.startsWith("heatsetinsert_"),
  )!
  expect(bolt.position.x).toBeCloseTo(-16, 6)
  expect(insert.position.x).toBeCloseTo(-16, 6)
  // Same mount axis, different Z: the bolt seats on top, the insert beneath.
  expect(bolt.position.y).toBeCloseTo(insert.position.y, 6)
  expect(bolt.position.z).toBeGreaterThan(insert.position.z)

  // Each piece owns its records, and its PCB owner takes no part in placement.
  for (const piece of hardware) {
    const pcbComponent = circuitJson.find(
      (element) =>
        element.type === "pcb_component" &&
        element.pcb_component_id === piece.pcb_component_id,
    ) as { do_not_place?: boolean; obstructs_within_bounds?: boolean }
    expect(pcbComponent).toBeTruthy()
    expect(pcbComponent.do_not_place).toBe(true)
    expect(pcbComponent.obstructs_within_bounds).toBe(false)

    expect(
      circuitJson.some(
        (element) =>
          element.type === "source_component" &&
          element.source_component_id === piece.source_component_id,
      ),
    ).toBe(true)
  }
})
