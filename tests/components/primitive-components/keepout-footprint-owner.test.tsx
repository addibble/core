import { expect, test } from "bun:test"
import {
  checkPcbComponentOverKeepout,
  checkPcbCopperOverKeepout,
} from "@tscircuit/checks"
import { getTestFixture } from "tests/fixtures/get-test-fixture"

test("footprint ownership suppresses only self footprint DRC, not owner copper or other components", async () => {
  const { circuit } = getTestFixture()
  circuit.add(
    <board width={30} height={20}>
      <chip
        name="OWNER"
        footprint={
          <footprint>
            <smtpad shape="rect" width={1} height={1} portHints={["1"]} />
            <keepout shape="circle" radius={2} />
          </footprint>
        }
      />
      <chip
        name="OTHER"
        pcbX={0.5}
        footprint={
          <footprint>
            <smtpad shape="rect" width={1} height={1} portHints={["1"]} />
          </footprint>
        }
      />
    </board>,
  )
  await circuit.renderUntilSettled()
  const owner = circuit.db.source_component.getWhere({ name: "OWNER" })!
  const ownerPcb = circuit.db.pcb_component.getWhere({
    source_component_id: owner.source_component_id,
  })!
  const keepout = circuit.db.pcb_keepout.list()[0]!
  expect(keepout.pcb_component_id).toBe(ownerPcb.pcb_component_id)
  expect(keepout.excluded_pcb_component_ids).toBeUndefined()
  const footprintErrors = checkPcbComponentOverKeepout(circuit.getCircuitJson())
  expect(footprintErrors).toHaveLength(1)
  expect(footprintErrors[0]!.message).toContain("OTHER")
  const copperErrors = checkPcbCopperOverKeepout(circuit.getCircuitJson())
  expect(copperErrors.some((error) => error.message.includes("OWNER"))).toBe(
    true,
  )
  for (const expected of [...footprintErrors, ...copperErrors]) {
    expect(
      circuit.db.pcb_placement_error
        .list()
        .filter((error) => error.message === expected.message),
    ).toHaveLength(1)
  }
})
