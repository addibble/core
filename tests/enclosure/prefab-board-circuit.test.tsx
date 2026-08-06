import { expect, test } from "bun:test"
import type { SolverStartedEvent } from "lib/events"
import { getTestFixture } from "tests/fixtures/get-test-fixture"
import PrefabBoardCircuit from "./prefab-board/prefab-board.circuit"

test("renders the prefab-board TSX with twelve part-owned apertures across six faces", async () => {
  const { circuit } = getTestFixture()
  let enclosureSolverEvent: SolverStartedEvent | undefined
  circuit.on("solver:started", (event) => {
    if (event.solverName === "CreateFdmEnclosureSolver") {
      enclosureSolverEvent = event
    }
  })
  circuit.add(<PrefabBoardCircuit />)

  await circuit.renderUntilSettled()

  const circuitJson = circuit.getCircuitJson()
  expect(
    circuitJson.filter((element) => element.type === "source_cutout_aperture"),
  ).toHaveLength(12)
  expect(
    circuitJson.filter((element) => element.type === "source_fdm_enclosure"),
  ).toHaveLength(1)
  // Base and lid are separate prints, so separate records.
  expect(
    circuitJson.filter((element) => element.type === "cad_fdm_enclosure"),
  ).toHaveLength(2)
  expect(
    circuitJson.filter(
      (element) =>
        element.type === "source_component" && /^J\d+$/.test(element.name),
    ),
  ).toHaveLength(10)
  expect(
    circuitJson.filter((element) => element.type === "pcb_smtpad"),
  ).toHaveLength(49)
  expect(
    circuitJson.filter((element) => element.type === "pcb_plated_hole"),
  ).toHaveLength(47)
  expect(
    circuitJson.filter((element) => element.type === "pcb_hole"),
  ).toHaveLength(14)
  expect(
    enclosureSolverEvent?.solverParams.apertures.map(
      (aperture: { face: string; center: { x: number; y: number } }) => ({
        face: aperture.face,
        // Only the along-face coordinate is meaningful; the other is pinned to
        // the face plane during resolution.
        // Side faces slide along one axis; horizontal faces are checked on both
        // coordinates separately below, so report X for them here.
        along:
          aperture.face === "x_neg" || aperture.face === "x_pos"
            ? Math.round(aperture.center.y * 10) / 10
            : Math.round(aperture.center.x * 10) / 10,
      }),
    ),
  ).toEqual([
    // `front` is +Y, matching `insertion_direction`. J1 and J6 sit at the -Y
    // edge, J3 and J4 at the +Y edge.
    { face: "y_neg", along: -18 },
    { face: "x_pos", along: -12 },
    { face: "y_pos", along: -18 },
    { face: "y_pos", along: 15 },
    { face: "x_pos", along: 10 },
    { face: "y_neg", along: 10 },
    { face: "x_neg", along: -12 },
    // Bottom-mounted, and each at a rotation where mirroring the insertion
    // direction the wrong way would move it to the opposite wall.
    { face: "x_neg", along: 8 },
    { face: "y_pos", along: 0 },
    { face: "y_neg", along: -4 },
    // SW1: a top-layer tact switch, so its plunger exits through the lid.
    { face: "z_pos", along: -5 },
    // LED1: mounted on the board bottom, so it exits through the floor.
    { face: "z_neg", along: -5 },
  ])

  // Both horizontal apertures keep both in-plane coordinates, straight from the
  // component placement.
  const verticalApertures = enclosureSolverEvent?.solverParams.apertures.filter(
    (aperture: { face: string }) =>
      aperture.face === "z_pos" || aperture.face === "z_neg",
  )
  expect(verticalApertures).toHaveLength(2)
  expect(verticalApertures[0].center).toMatchObject({ x: -5, y: 10 })
  expect(verticalApertures[1].center).toMatchObject({ x: -5, y: -5 })
})
