import { expect, test } from "bun:test"
import { enclosure } from "lib"
import type { SolverStartedEvent } from "lib/events"
import { getTestFixture } from "tests/fixtures/get-test-fixture"

/**
 * Wall selection is quantized, but the cutting axis must not be. The exact
 * +/-45-degree tie is discriminating: floating-point face quantization may
 * choose either adjacent wall, while the continuous vectors lean in opposite
 * directions. Reconstructing the angle from rotation alone collapsed +45 to
 * -45 and sent its cutter 90 degrees the wrong way. Passing the source vector
 * keeps the orientation correct whichever tied face core actually selected.
 */
test("core passes the unquantized aperture axis paired with its selected face", () => {
  const renderAt = (rotation: number) => {
    const { circuit } = getTestFixture()
    let enclosureSolverEvent: SolverStartedEvent | undefined
    circuit.on("solver:started", (event) => {
      if (event.solverName === "CreateFdmEnclosureSolver") {
        enclosureSolverEvent = event
      }
    })

    circuit.add(
      <group>
        <board name="B1" width="60mm" height="60mm" routingDisabled>
          <connector
            name="J1"
            pcbX="20mm"
            pcbY={rotation < 0 ? "-20mm" : "20mm"}
            pcbRotation={`${rotation}deg`}
            footprint={
              <footprint insertionDirection="from_left">
                <smtpad
                  portHints={["pin1"]}
                  pcbX="-2mm"
                  pcbY="0mm"
                  width="1mm"
                  height="1mm"
                  shape="rect"
                />
                <smtpad
                  portHints={["pin2"]}
                  pcbX="2mm"
                  pcbY="1mm"
                  width="1mm"
                  height="1mm"
                  shape="rect"
                />
              </footprint>
            }
          >
            <enclosure.cutoutaperture shape="circle" radius="1.5mm" />
          </connector>
        </board>
        <enclosure.fdm.box boardRef=".B1" />
      </group>,
    )
    circuit.render()

    const pcbComponent = circuit.db.pcb_component.list()[0]!
    return {
      aperture: enclosureSolverEvent?.solverParams.apertures[0],
      componentCenter: pcbComponent.center,
      cableInsertionCenter: pcbComponent.cable_insertion_center,
    }
  }

  const negativeResult = renderAt(-45)
  const positiveResult = renderAt(45)
  const negativeTie = negativeResult.aperture
  const positiveTie = positiveResult.aperture
  const diagonal = Math.SQRT1_2

  expect(["x_neg", "y_pos"]).toContain(negativeTie.face)
  expect(negativeTie.apertureAxisDirection.x).toBeCloseTo(-diagonal)
  expect(negativeTie.apertureAxisDirection.y).toBeCloseTo(diagonal)
  expect(negativeTie.apertureAxisDirection.z).toBe(0)

  expect(["x_neg", "y_neg"]).toContain(positiveTie.face)
  expect(positiveTie.apertureAxisDirection.x).toBeCloseTo(-diagonal)
  expect(positiveTie.apertureAxisDirection.y).toBeCloseTo(-diagonal)
  expect(positiveTie.apertureAxisDirection.z).toBe(0)

  // The inferred cable point comes from a quantized side of the component's
  // axis-aligned bounds and jumps at a face transition. The aperture axis must
  // instead pass through the stable datum the body itself rotates around.
  expect(negativeResult.cableInsertionCenter).not.toEqual(
    negativeResult.componentCenter,
  )
  expect(negativeTie.center).toEqual(negativeResult.componentCenter)
  expect(positiveTie.center).toEqual(positiveResult.componentCenter)
})
