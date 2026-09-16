import { expect, test } from "bun:test"
import { AssemblyBolt } from "lib/components"
import { getMountingKeepoutFixture } from "tests/fixtures/mounting-keepout-fixture"

test("changing lid retention deletes the old top support keepout and its stale errors", async () => {
  const { circuit, generatedKeepouts } = await getMountingKeepoutFixture({
    kind: "column",
  })
  const top = generatedKeepouts().find((keepout) =>
    keepout.layers.includes("top"),
  )!
  const bolt = circuit
    .firstChild!.getDescendants()
    .find(
      (component): component is AssemblyBolt =>
        component instanceof AssemblyBolt,
    )!
  const topErrors = circuit.db.pcb_placement_error
    .list()
    .filter((error) => error.message.includes(top.description!))
  expect(topErrors.length).toBeGreaterThan(0)
  bolt.setProps({ lidColumn: false })
  await circuit.renderUntilSettled()
  expect(
    circuit.db.pcb_keepout
      .list()
      .some((keepout) => keepout.pcb_keepout_id === top.pcb_keepout_id),
  ).toBe(false)
  expect(generatedKeepouts()).toHaveLength(1)
  for (const previous of topErrors) {
    expect(
      circuit.db.pcb_placement_error
        .list()
        .some((error) => error.message === previous.message),
    ).toBe(false)
  }
})
