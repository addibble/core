import { expect, test } from "bun:test"
import { enclosure } from "lib"
import type { SolverStartedEvent } from "lib/events"
import { getTestFixture } from "tests/fixtures/get-test-fixture"

test("a mismatched cable projection falls back to the component tangent center", () => {
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
          pcbX="-3mm"
          pcbY="-9mm"
          footprint={
            <footprint>
              <smtpad
                portHints={["pin1"]}
                width="4mm"
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

  // No `insertionDirection` is authored, so this exercises the nearest-edge
  // fallback. The part sits at y=-9 on a 20mm board, so that edge is -Y: `back`.
  expect(enclosureSolverEvent?.solverParams.apertures[0]).toMatchObject({
    face: "y_neg",
  })
  expect(enclosureSolverEvent?.solverParams.apertures[0].center.x).toBeCloseTo(
    -3,
  )
})
