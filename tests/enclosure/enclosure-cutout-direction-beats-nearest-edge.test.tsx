import { expect, test } from "bun:test"
import { enclosure } from "lib"
import type { SolverStartedEvent } from "lib/events"
import { getTestFixture } from "tests/fixtures/get-test-fixture"

test("a declared insertion direction outranks the nearest board edge", () => {
  const { circuit } = getTestFixture()
  let enclosureSolverEvent: SolverStartedEvent | undefined
  circuit.on("solver:started", (event) => {
    if (event.solverName === "CreateFdmEnclosureSolver") {
      enclosureSolverEvent = event
    }
  })

  // J1 sits 1mm from the +Y edge and 12mm from the +X edge, so nearest-edge
  // would put its aperture in the y_pos wall. It declares `from_right`, so the
  // aperture belongs in x_pos instead.
  //
  // The two sources of truth must disagree here, otherwise the test cannot tell
  // which one was used -- every other enclosure fixture happens to place parts
  // where they agree, so nothing else pins this.
  circuit.add(
    <group>
      <board name="B1" width="40mm" height="24mm" routingDisabled>
        <connector
          name="J1"
          pcbX="8mm"
          pcbY="11mm"
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

  const pcbComponent = circuit.db.pcb_component
    .list()
    .find((component) => component.pcb_component_id)!
  expect(pcbComponent.insertion_direction).toBe("from_right")

  expect(enclosureSolverEvent?.solverParams.apertures[0]).toMatchObject({
    face: "x_pos",
  })
})
