import { expect, test } from "bun:test"
import {
  checkPcbComponentOverKeepout,
  checkPcbCopperOverKeepout,
} from "@tscircuit/checks"
import { NormalComponent } from "lib/components"
import { getMountingKeepoutFixture } from "tests/fixtures/mounting-keepout-fixture"

test("moving a part removes stale mounting DRC without deleting authored output or restarting routing", async () => {
  const { circuit, generatedKeepouts } = await getMountingKeepoutFixture()
  const authoredKeepout = circuit.db.pcb_keepout
    .list()
    .find((keepout) => !keepout.description)!
  const authoredError = circuit.db.pcb_placement_error.insert({
    error_type: "pcb_placement_error",
    message: "Authored diagnostic must survive enclosure refresh",
  })
  const beforeKeepouts = generatedKeepouts().map(
    (keepout) => keepout.pcb_keepout_id,
  )
  const beforeHardware = circuit.db.cad_component
    .list()
    .map((cad) => cad.cad_component_id)
  const bottom = circuit.selectOne(".B1 .BOTTOM")
  if (!(bottom instanceof NormalComponent))
    throw new Error("Expected bottom component")
  const oldErrors = [
    ...checkPcbComponentOverKeepout(circuit.getCircuitJson()),
    ...checkPcbCopperOverKeepout(circuit.getCircuitJson()),
  ]
  expect(oldErrors.length).toBeGreaterThan(0)
  const routingEvents: string[] = []
  circuit.on("solver:started", (event) => routingEvents.push(event.solverName))
  bottom._repositionOnPcb({ x: 110, y: 200 })
  await circuit.renderUntilSettled()
  for (const old of oldErrors) {
    expect(
      circuit.db.pcb_placement_error
        .list()
        .some((error) => error.message === old.message),
    ).toBe(false)
  }
  expect(circuit.db.pcb_keepout.get(authoredKeepout.pcb_keepout_id)).toEqual(
    authoredKeepout,
  )
  expect(
    circuit.db.pcb_placement_error.get(authoredError.pcb_placement_error_id),
  ).toEqual(authoredError)
  expect(generatedKeepouts().map((keepout) => keepout.pcb_keepout_id)).toEqual(
    beforeKeepouts,
  )
  expect(
    circuit.db.cad_component.list().map((cad) => cad.cad_component_id),
  ).toEqual(beforeHardware)
  expect(
    routingEvents.every((name) => name === "CreateFdmEnclosureSolver"),
  ).toBe(true)
})
