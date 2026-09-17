import { expect, test } from "bun:test"
import {
  checkPcbComponentOverKeepout,
  checkPcbCopperOverKeepout,
} from "@tscircuit/checks"
import { getMountingKeepoutFixture } from "tests/fixtures/mounting-keepout-fixture"

test("mounting keepouts detect bodies on each side even when every pad is outside", async () => {
  const { circuit, generatedKeepouts } = await getMountingKeepoutFixture({
    bodyOnly: true,
  })
  const circuitJson = circuit.getCircuitJson()
  expect(checkPcbCopperOverKeepout(circuitJson)).toHaveLength(0)
  for (const side of ["top", "bottom"] as const) {
    const keepouts = generatedKeepouts().filter((keepout) =>
      keepout.layers.includes(side),
    )
    const errors = checkPcbComponentOverKeepout(circuitJson, keepouts)
    expect(errors).toHaveLength(1)
    expect(errors[0]!.message).toContain(side.toUpperCase())
    expect(
      circuit.db.pcb_placement_error
        .list()
        .filter((error) => error.message === errors[0]!.message),
    ).toHaveLength(1)
  }
})
