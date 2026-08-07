import { expect, test } from "bun:test"
import { enclosure } from "lib"
import type { SolverStartedEvent } from "lib/events"
import { getTestFixture } from "tests/fixtures/get-test-fixture"

/**
 * A side-actuated switch is *installed* from above and *actuated* from the
 * side. Both are true of the same part, and the opening follows the second one:
 * it has to pierce a wall, while nothing is ever inserted into the switch.
 *
 * With only `insertionDirection` there was nowhere to say that. A footprint
 * declaring `from_above` -- which is honest, it is a through-hole part pressed
 * in from above -- put the opening in the lid, above a plunger pointing
 * sideways at a wall.
 */
test("the actuation direction places the opening, not the insertion direction", () => {
  const { circuit } = getTestFixture()
  let enclosureSolverEvent: SolverStartedEvent | undefined
  circuit.on("solver:started", (event) => {
    if (event.solverName === "CreateFdmEnclosureSolver") {
      enclosureSolverEvent = event
    }
  })

  circuit.add(
    <group>
      <board name="B1" width="40mm" height="24mm" routingDisabled>
        <pushbutton
          name="SW1"
          pcbX="14mm"
          pcbY="0mm"
          footprint={
            <footprint
              insertionDirection="from_above"
              cutoutApertureDirection="from_right"
            >
              <smtpad
                portHints={["pin1"]}
                width="2mm"
                height="2mm"
                shape="rect"
              />
            </footprint>
          }
        >
          <enclosure.cutoutaperture shape="circle" radius="1.6mm" />
        </pushbutton>
      </board>
      <enclosure.fdm.box boardRef=".B1" />
    </group>,
  )
  circuit.render()

  const pcbComponent = circuit.db.pcb_component
    .list()
    .find((component) => component.pcb_component_id)!
  // Both facts survive, in board coordinates.
  expect(pcbComponent.insertion_direction).toBe("from_above")
  expect(pcbComponent.cutout_aperture_direction).toBe("from_right")

  // The opening is in the wall the actuator points at, not the lid the part was
  // installed through.
  expect(enclosureSolverEvent?.solverParams.apertures[0]).toMatchObject({
    face: "x_pos",
  })
})

/**
 * The new field is a property of the part, so it must ride the same transform
 * `insertion_direction` does. A part rotated 90 degrees on the board actuates
 * 90 degrees around with it; deriving the two separately is how they drift.
 */
test("the actuation direction rotates with the component", () => {
  const { circuit } = getTestFixture()
  let enclosureSolverEvent: SolverStartedEvent | undefined
  circuit.on("solver:started", (event) => {
    if (event.solverName === "CreateFdmEnclosureSolver") {
      enclosureSolverEvent = event
    }
  })

  circuit.add(
    <group>
      <board name="B1" width="40mm" height="24mm" routingDisabled>
        <pushbutton
          name="SW1"
          pcbX="0mm"
          pcbY="9mm"
          pcbRotation="90deg"
          footprint={
            <footprint
              insertionDirection="from_above"
              cutoutApertureDirection="from_right"
            >
              <smtpad
                portHints={["pin1"]}
                width="2mm"
                height="2mm"
                shape="rect"
              />
            </footprint>
          }
        >
          <enclosure.cutoutaperture shape="circle" radius="1.6mm" />
        </pushbutton>
      </board>
      <enclosure.fdm.box boardRef=".B1" />
    </group>,
  )
  circuit.render()

  const pcbComponent = circuit.db.pcb_component
    .list()
    .find((component) => component.pcb_component_id)!
  expect(pcbComponent.cutout_aperture_direction).toBe("from_top")

  expect(enclosureSolverEvent?.solverParams.apertures[0]).toMatchObject({
    face: "y_pos",
  })
})

/**
 * Absent, the opening faces the way the part is entered. That is correct for
 * every connector -- a cable arrives through the opening it needs -- and is why
 * this is a fallback rather than a separate required field.
 */
test("without an actuation direction the opening follows the insertion direction", () => {
  const { circuit } = getTestFixture()
  let enclosureSolverEvent: SolverStartedEvent | undefined
  circuit.on("solver:started", (event) => {
    if (event.solverName === "CreateFdmEnclosureSolver") {
      enclosureSolverEvent = event
    }
  })

  circuit.add(
    <group>
      <board name="B1" width="40mm" height="24mm" routingDisabled>
        <connector
          name="J1"
          pcbX="14mm"
          pcbY="0mm"
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
          <enclosure.cutoutaperture shape="circle" radius="1.6mm" />
        </connector>
      </board>
      <enclosure.fdm.box boardRef=".B1" />
    </group>,
  )
  circuit.render()

  const pcbComponent = circuit.db.pcb_component
    .list()
    .find((component) => component.pcb_component_id)!
  expect(pcbComponent.cutout_aperture_direction).toBeUndefined()

  expect(enclosureSolverEvent?.solverParams.apertures[0]).toMatchObject({
    face: "x_pos",
  })
})
