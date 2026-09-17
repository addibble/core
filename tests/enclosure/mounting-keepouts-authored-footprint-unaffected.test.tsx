import { expect, test } from "bun:test"
import {
  checkPcbComponentOverKeepout,
  checkPcbCopperOverKeepout,
} from "@tscircuit/checks"
import { assembly, enclosure } from "lib"
import { EnclosureFdmBox } from "lib/components"
import { getTestFixture } from "tests/fixtures/get-test-fixture"

test("ordinary footprint keepouts retain copper DRC without gaining footprint self-collisions", async () => {
  const { circuit } = getTestFixture()
  circuit.add(
    <assembly.device>
      <board name="B1" width={40} height={24}>
        <hole name="H1" diameter={3.4}>
          <assembly.screw thread="m3" />
        </hole>
        <chip
          name="OWN"
          pcbX={12}
          footprint={
            <footprint>
              <smtpad portHints={["1"]} width={0.8} height={0.8} shape="rect" />
              <keepout shape="circle" radius={1} />
            </footprint>
          }
        />
      </board>
      <enclosure.fdm.box name="EN1" boardRef=".B1" standoffHeight={10} />
    </assembly.device>,
  )
  await circuit.renderUntilSettled()
  const enclosureBox = circuit.selectOne(".EN1")
  if (!(enclosureBox instanceof EnclosureFdmBox))
    throw new Error("Expected enclosure instance")
  const mountingKeepouts = enclosureBox.generatedElements.filter(
    (element) => element.type === "pcb_keepout",
  )
  const authoredKeepout = circuit.db.pcb_keepout
    .list()
    .find((keepout) => !mountingKeepouts.includes(keepout))!
  // Even a mounting-looking description cannot make an authored keepout generated.
  circuit.db.pcb_keepout.update(authoredKeepout.pcb_keepout_id, {
    description: mountingKeepouts[0]!.description,
  })
  await circuit.renderUntilSettled()
  const circuitJson = circuit.getCircuitJson()
  const footprintErrors = checkPcbComponentOverKeepout(
    circuitJson,
    circuit.db.pcb_keepout.list(),
  )
  expect(footprintErrors).toHaveLength(1)
  expect(footprintErrors[0]!.message).toContain("OWN")
  expect(
    circuit.db.pcb_placement_error
      .list()
      .some((error) => error.message === footprintErrors[0]!.message),
  ).toBe(false)
  const copperErrors = checkPcbCopperOverKeepout(circuitJson)
  expect(copperErrors.length).toBeGreaterThan(0)
  for (const expected of copperErrors) {
    expect(
      circuit.db.pcb_placement_error
        .list()
        .filter((error) => error.message === expected.message),
    ).toHaveLength(1)
  }
})
