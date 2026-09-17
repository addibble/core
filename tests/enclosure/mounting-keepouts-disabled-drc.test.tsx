import { expect, test } from "bun:test"
import { getMountingKeepoutFixture } from "tests/fixtures/mounting-keepout-fixture"

test("generated mounting footprint checks respect placement and all-DRC disable flags", async () => {
  for (const platform of [
    { placementDrcChecksDisabled: true },
    { drcChecksDisabled: true },
  ]) {
    const { circuit, generatedKeepouts } = await getMountingKeepoutFixture({
      platform,
      bodyOnly: true,
    })
    expect(generatedKeepouts()).toHaveLength(2)
    expect(
      circuit.db.pcb_placement_error
        .list()
        .filter((error) => error.message.includes("keepout")),
    ).toHaveLength(0)
  }
})
