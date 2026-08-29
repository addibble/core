import { expect, test } from "bun:test"
import { enclosure } from "lib"
import type { SolverStartedEvent } from "lib/events"
import { getTestFixture } from "tests/fixtures/get-test-fixture"

/**
 * `cad_component` carries the *name* of a footprinter model, not its geometry,
 * so a part authored by footprint alone used to reach the enclosure with its pad
 * extent and no height at all -- which left every clearance check undecidable.
 * The body behind that name is built and measured instead.
 *
 * A SOIC-8 shows why the pads were never enough: they measure 5.30 x 4.41mm and
 * say nothing about how tall it is, while the body is 5.30 x 4.62 x 1.28mm.
 */
test("a part authored by footprint alone arrives with a measured body, not pad extents", async () => {
  const { circuit } = getTestFixture()
  let event: SolverStartedEvent | undefined
  circuit.on("solver:started", (e) => {
    if (e.solverName === "CreateFdmEnclosureSolver") event = e
  })

  circuit.add(
    <group>
      <board name="main-board" width="40mm" height="24mm" routingDisabled>
        <chip name="U1" footprint="soic8" pcbX={0} pcbY={0} />
      </board>
      <enclosure.fdm.box name="EN1" boardRef=".main-board" />
    </group>,
  )

  await circuit.renderUntilSettled()

  const u1 = (event?.solverParams.components as any[]).find((component) =>
    component.id.includes("U1"),
  )

  const pcbComponent = circuit.db.pcb_component.list()[0]!
  expect(u1.body.footprint.width).toBeCloseTo(pcbComponent.width, 5)

  // The measured body, which the pads could not have given: wider than the pad
  // extent across Y, and carrying a height where there was none.
  expect(u1.body.size.y).toBeGreaterThan(pcbComponent.height)
  expect(u1.body.aboveBoardHeight).toBeCloseTo(1.28, 1)
})
