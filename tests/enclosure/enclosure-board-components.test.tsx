import { expect, test } from "bun:test"
import { enclosure } from "lib"
import type { SolverStartedEvent } from "lib/events"
import { getTestFixture } from "tests/fixtures/get-test-fixture"

/**
 * The enclosure hands the solver every part on the board, so its mounting
 * features can be checked against them. The envelope comes from the same
 * `getComponentBody` path an aperture uses to size its own opening -- an
 * aperture and a screw boss disagreeing about how big a connector is would be a
 * very hard defect to see.
 *
 * A part with an authored `cadModel` carries a measured body. A part whose model
 * is only named by a footprinter string does not: the body behind that name is
 * built downstream by the renderers, so it arrives with a footprint and no
 * height, and the solver reports it as undecidable rather than clear.
 */
test("every part on the board reaches the solver, measured where a model says so", async () => {
  const { circuit } = getTestFixture()
  let event: SolverStartedEvent | undefined
  circuit.on("solver:started", (e) => {
    if (e.solverName === "CreateFdmEnclosureSolver") event = e
  })

  circuit.add(
    <group>
      <board name="main-board" width="40mm" height="24mm" routingDisabled>
        <chip
          name="U1"
          footprint="soic8"
          pcbX={-12}
          pcbY={-6}
          cadModel={{
            objUrl: "https://example.com/u1.obj",
            size: { x: 6, y: 6, z: 4 },
            modelOriginPosition: { x: 0, y: 0, z: -2 },
            modelBounds: {
              min: { x: -3, y: -3, z: -2 },
              max: { x: 3, y: 3, z: 2 },
            },
          }}
        />
        <resistor
          name="R1"
          resistance="1k"
          footprint="0402"
          pcbX={12}
          pcbY={6}
        />
      </board>
      <enclosure.fdm.box name="EN1" boardRef=".main-board" />
    </group>,
  )

  await circuit.renderUntilSettled()

  const components = event?.solverParams.components as any[]
  const byName = (needle: string) =>
    components.find((component) => component.id.includes(needle))

  expect(components.length).toBeGreaterThanOrEqual(2)

  const u1 = byName("U1")
  expect(u1.center).toMatchObject({ x: -12, y: -6 })
  expect(u1.boardSide).toBe("top")
  // Measured from the model, not guessed from `size`: the origin sits at the
  // model's underside (z -2) and its bounds reach z 2, so the part stands 4mm
  // off the board. `size.z` happens to agree here; for a part with pins or a
  // through-board shell it would not, which is why the bounds are preferred.
  expect(u1.body.aboveBoardHeight).toBeCloseTo(4)
  expect(u1.body.size).toMatchObject({ x: 6, y: 6, z: 4 })

  // R1 authored no `cadModel` at all -- only `footprint="0402"`. Its body is the
  // generic one behind that name, built and measured here because `cad_component`
  // carries the name rather than the geometry.
  const r1 = byName("R1")
  expect(r1.center).toMatchObject({ x: 12, y: 6 })
  expect(r1.body.size.x).toBeCloseTo(1, 1)
  expect(r1.body.size.y).toBeCloseTo(0.5, 1)
  expect(r1.body.aboveBoardHeight).toBeCloseTo(0.5, 1)
})
