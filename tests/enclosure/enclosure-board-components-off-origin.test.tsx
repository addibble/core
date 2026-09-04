import { expect, test } from "bun:test"
import { assembly, enclosure } from "lib"
import type { SolverStartedEvent } from "lib/events"
import { getTestFixture } from "tests/fixtures/get-test-fixture"

/**
 * Parts and mounts reach the solver in ONE frame: board-relative XY, the frame
 * apertures already use.
 *
 * The solver differences the two directly -- `checkComponentClearance` asks
 * whether a boss at `mount.anchor` runs into a part at `component.center` -- so
 * the check is only meaningful if both were measured from the same origin.
 *
 * The board is deliberately placed AWAY FROM THE ORIGIN. On a board at (0, 0)
 * the board-relative and absolute frames coincide exactly, so a test authored
 * there passes whichever one the code used, and cannot fail. That is what let
 * `getEnclosureBoardComponents` emit absolute centres unnoticed: every part was
 * offset from every boss by the board's own placement, and a boss driven
 * straight through a connector cleared.
 *
 * The assertion is that the two AGREE, not that either equals a restatement of
 * the subtraction: the hole and the chip are authored at the same board-relative
 * X, so their solver-side X must match no matter how each was derived.
 */
test("parts and mounts reach the solver in the same board-relative frame", async () => {
  const { circuit } = getTestFixture()
  let event: SolverStartedEvent | undefined
  circuit.on("solver:started", (e) => {
    if (e.solverName === "CreateFdmEnclosureSolver") event = e
  })

  const BOARD_CENTER = { x: 100, y: 50 }
  const SHARED_X = -15

  circuit.add(
    <assembly.device name="DEV1">
      <board
        name="B1"
        width="40mm"
        height="24mm"
        pcbX={BOARD_CENTER.x}
        pcbY={BOARD_CENTER.y}
        routingDisabled
      >
        <hole name="H1" pcbX={SHARED_X} pcbY={-8} diameter="3.4mm">
          <assembly.screw thread="m3" />
        </hole>
        <chip name="U1" footprint="soic8" pcbX={SHARED_X} pcbY={8} />
      </board>
      <enclosure.fdm.box name="EN1" boardRef=".B1" standoffHeight={8} />
    </assembly.device>,
  )

  await circuit.renderUntilSettled()

  const params = event?.solverParams as {
    mounts: Array<{ anchor: { x: number; y: number } }>
    components: Array<{ id: string; center: { x: number; y: number } }>
  }

  const mount = params.mounts[0]!
  const u1 = params.components.find((c) => c.id.includes("U1"))!

  expect(mount.anchor.x).toBeCloseTo(SHARED_X)
  expect(u1.center.x).toBeCloseTo(SHARED_X)
  // The frames agree, which is the property the clearance check depends on.
  expect(u1.center.x).toBeCloseTo(mount.anchor.x)
  // ...and neither carries the board's placement.
  expect(Math.abs(u1.center.x - BOARD_CENTER.x)).toBeGreaterThan(1)
})
