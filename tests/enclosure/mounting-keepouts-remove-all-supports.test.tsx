import { expect, test } from "bun:test"
import { AssemblyScrew } from "lib/components"
import { getMountingKeepoutFixture } from "tests/fixtures/mounting-keepout-fixture"

test("removing the last mount clears generated footprint errors while retaining the enclosure", async () => {
  const { circuit, enclosureBox, generatedKeepouts } =
    await getMountingKeepoutFixture({ bodyOnly: true })
  const mountingErrors = () =>
    circuit.db.pcb_placement_error
      .list()
      .filter((error) => error.message.includes("keepout"))
  expect(mountingErrors()).toHaveLength(2)
  const screw = circuit
    .firstChild!.getDescendants()
    .find(
      (component): component is AssemblyScrew =>
        component instanceof AssemblyScrew,
    )!
  screw.parent!.remove(screw)
  await circuit.renderUntilSettled()
  expect(generatedKeepouts()).toHaveLength(0)
  expect(mountingErrors()).toHaveLength(0)
  expect(
    enclosureBox.generatedElements.filter(
      (element) => element.type === "cad_component",
    ),
  ).toHaveLength(2)
})
