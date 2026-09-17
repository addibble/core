import { expect, test } from "bun:test"
import { getMountingKeepoutFixture } from "tests/fixtures/mounting-keepout-fixture"

test("removing an enclosure clears every generated mounting keepout and footprint error", async () => {
  const { circuit, enclosureBox, generatedKeepouts } =
    await getMountingKeepoutFixture({ bodyOnly: true })
  const keepouts = [...generatedKeepouts()]
  const errors = circuit.db.pcb_placement_error
    .list()
    .filter((error) => error.message.includes("keepout"))
  expect(errors).toHaveLength(2)
  enclosureBox.parent!.remove(enclosureBox)
  await circuit.renderUntilSettled()
  for (const keepout of keepouts) {
    expect(
      circuit.db.pcb_keepout
        .list()
        .some((element) => element.pcb_keepout_id === keepout.pcb_keepout_id),
    ).toBe(false)
  }
  for (const previous of errors) {
    expect(
      circuit.db.pcb_placement_error
        .list()
        .some((error) => error.message === previous.message),
    ).toBe(false)
  }
})
