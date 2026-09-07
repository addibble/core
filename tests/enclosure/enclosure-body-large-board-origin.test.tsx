import { expect, test } from "bun:test"
import { getComponentBody } from "lib/components/primitive-components/EnclosureCutoutAperture/get-component-body"
import { getTestFixture } from "tests/fixtures/get-test-fixture"

test("board-frame body bounds retain small dimensions far from the world origin", () => {
  const { circuit } = getTestFixture()
  const source = circuit.db.source_component.insert({
    ftype: "simple_chip",
    name: "U1",
  })
  const boardCenter = { x: 1_000_000, y: -1_000_000 }
  const position = {
    x: boardCenter.x + 0.03,
    y: boardCenter.y - 0.07,
    z: -0.8,
  }
  const pcb = circuit.db.pcb_component.insert({
    source_component_id: source.source_component_id,
    center: boardCenter,
    width: 1,
    height: 1,
    layer: "bottom",
    rotation: 0,
    obstructs_within_bounds: true,
  })
  const cad = circuit.db.cad_component.insert({
    source_component_id: source.source_component_id,
    pcb_component_id: pcb.pcb_component_id,
    position,
    rotation: { x: 0, y: 180, z: 0 },
    size: { x: 6.1, y: 4.3, z: 20.7 },
    model_board_normal_direction: "y+",
    model_origin_position: { x: 0, y: 0, z: 0 },
    model_unit_to_mm_scale_factor: 1,
    anchor_alignment: "center",
    model_object_fit: "contain_within_bounds",
  })
  const body = getComponentBody({
    pcbComponent: pcb,
    cadComponent: cad,
    boardCenter,
    boardSurfaceZ: -0.8,
  })
  expect(body.solid).toBeUndefined()
  expect(body.size?.x).toBeCloseTo(6.1, 6)
  expect(body.size?.y).toBeCloseTo(20.7, 6)
  expect(body.size?.z).toBeCloseTo(4.3, 6)
  expect(body.aboveBoardHeight).toBeCloseTo(4.3, 6)
  expect((body.bounds!.min.x + body.bounds!.max.x) / 2).toBeCloseTo(0.03, 6)
  expect((body.bounds!.min.y + body.bounds!.max.y) / 2).toBeCloseTo(-0.07, 6)
  expect(cad.position).toEqual(position)
})
