import { expect, test } from "bun:test"
import { assembly, enclosure } from "lib"
import type { SolverStartedEvent } from "lib/events"
import { getTestFixture } from "tests/fixtures/get-test-fixture"

test("enclosure.fdm.box emits its complete typed source contract", () => {
  const { circuit } = getTestFixture()
  let enclosureSolverEvent: SolverStartedEvent | undefined
  circuit.on("solver:started", (event) => {
    if (event.solverName === "CreateFdmEnclosureSolver") {
      enclosureSolverEvent = event
    }
  })
  circuit.add(
    <assembly.device name="controller">
      <board name="B1" width="30mm" height="20mm">
        <chip name="U1" footprint="soic8">
          <enclosure.cutoutaperture
            shape="circle"
            radius="2mm"
            heightDimensionOffset="6.5mm"
          />
        </chip>
      </board>
      <enclosure.fdm.box
        name="EN1"
        boardRef=".B1"
        width="40mm"
        height="30mm"
        depth="20mm"
        wallThickness="2.4mm"
        floorThickness="2.2mm"
        lidThickness="1.8mm"
        boardClearance="0.8mm"
        standoffHeight="4mm"
        topHeadroom="6mm"
        lidLipDepth="3mm"
        disableCutouts
      />
    </assembly.device>,
  )
  circuit.render()

  expect(circuit.db.source_fdm_enclosure.list()[0]).toMatchObject({
    source_board_id: circuit.db.source_board.list()[0].source_board_id,
    name: "EN1",
    width: 40,
    height: 30,
    depth: 20,
    wall_thickness: 2.4,
    floor_thickness: 2.2,
    lid_thickness: 1.8,
    board_clearance: 0.8,
    standoff_height: 4,
    top_headroom: 6,
    lid_lip_depth: 3,
    disable_cutouts: true,
  })
  expect(circuit.db.source_cutout_aperture.list()).toHaveLength(1)
  expect(circuit.db.source_cutout_aperture.list()[0]).toMatchObject({
    height_dimension_offset: 6.5,
  })
  expect(circuit.db.cad_fdm_enclosure.list()).toHaveLength(2)
  expect(enclosureSolverEvent?.solverParams).toMatchObject({
    width: 40,
    height: 30,
    depth: 20,
    wallThickness: 2.4,
    floorThickness: 2.2,
    lidThickness: 1.8,
    boardClearance: 0.8,
    standoffHeight: 4,
    topHeadroom: 6,
    lidLipDepth: 3,
    apertures: [],
  })
  expect(circuit.db.cad_fdm_enclosure.list()[0].position.z).toBeCloseTo(-6.9)
})
