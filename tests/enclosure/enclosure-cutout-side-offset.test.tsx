import { expect, test } from "bun:test"
import { enclosure } from "lib"
import type { SolverStartedEvent } from "lib/events"
import { getTestFixture } from "tests/fixtures/get-test-fixture"

test("side-wall aperture offsets preserve PCB Y orientation", () => {
  const { circuit } = getTestFixture()
  let enclosureSolverEvent: SolverStartedEvent | undefined
  circuit.on("solver:started", (event) => {
    if (event.solverName === "CreateFdmEnclosureSolver") {
      enclosureSolverEvent = event
    }
  })

  circuit.add(
    <group>
      <board name="B1" width="20mm" height="20mm" routingDisabled>
        <connector
          name="J1"
          pcbX="9mm"
          pcbY="-4mm"
          footprint={
            <footprint insertionDirection="from_right">
              <smtpad
                portHints={["pin1"]}
                width="2mm"
                height="2mm"
                shape="rect"
              />
            </footprint>
          }
        >
          <enclosure.cutoutaperture shape="circle" radius="2mm" />
        </connector>
      </board>
      <enclosure.fdm.box boardRef=".B1" />
    </group>,
  )
  circuit.render()

  // Only the coordinate tangent to the face matters; the resolver pins the
  // other one to the face plane.
  expect(enclosureSolverEvent?.solverParams.apertures[0]).toMatchObject({
    face: "x_pos",
  })
  expect(enclosureSolverEvent?.solverParams.apertures[0].center.y).toBeCloseTo(
    -4,
  )
})
