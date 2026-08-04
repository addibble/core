import { expect, test } from "bun:test"
import { assembly, enclosure } from "lib"
import type { SolverStartedEvent } from "lib/events"
import { getTestFixture } from "tests/fixtures/get-test-fixture"

const apertureFor = async (pcbRotation: number) => {
  const { circuit } = getTestFixture()
  let event: SolverStartedEvent | undefined
  circuit.on("solver:started", (e) => {
    if (e.solverName === "CreateFdmEnclosureSolver") event = e
  })

  circuit.add(
    <assembly.device name="dev">
      <board name="B1" width="40mm" height="24mm" routingDisabled>
        <chip
          name="SW1"
          pcbX={0}
          pcbY={0}
          pcbRotation={pcbRotation}
          footprint={
            <footprint insertionDirection={"from_above" as any}>
              <smtpad
                shape="rect"
                portHints={["pin1"]}
                pcbX={0}
                pcbY={0}
                width={2}
                height={2}
              />
            </footprint>
          }
        >
          <enclosure.cutoutaperture shape="rect" width="8mm" height="3mm" />
        </chip>
      </board>
      <enclosure.fdm.box boardRef=".B1" />
    </assembly.device>,
  )
  await circuit.renderUntilSettled()
  return (event as any)?.solverParams.apertures[0]
}

// A part mating along +Z exits through the lid, and it can be placed at any
// rotation on the board. Its opening has to turn with it, or a rotated
// rectangular part gets a cutout still squared to board X/Y and fouls its own
// hole.
test("a rotated lid part gets a rotated opening", async () => {
  const straight = await apertureFor(0)
  const turned = await apertureFor(30)

  expect(straight.face).toBe("z_pos")
  expect(turned.face).toBe("z_pos")

  expect(straight.rotation ?? 0).toBeCloseTo(0, 6)
  expect(turned.rotation).toBeCloseTo(30, 6)

  // The opening keeps its own dimensions; only its orientation changes.
  expect(turned.width).toBeCloseTo(straight.width, 6)
  expect(turned.height).toBeCloseTo(straight.height, 6)
})
