import { expect, test } from "bun:test"
import * as jscad from "@jscad/modeling"
import { getCadModelPlacement, mat4 } from "@tscircuit/circuit-json-util"
import { assertTransformMatrix } from "jscad-planner"
import { assembly, enclosure } from "lib"
import { getEnclosureCadModelBody } from "lib/components/primitive-components/get-enclosure-cad-model-body"
import { getTestFixture } from "tests/fixtures/get-test-fixture"

test("generated base and lid preserve their shared assembly origin through CAD placement", async () => {
  const { circuit } = getTestFixture()
  circuit.add(
    <assembly.device>
      <board
        name="B1"
        width={40}
        height={24}
        pcbX={12}
        pcbY={-4}
        routingDisabled
      />
      <enclosure.fdm.box name="EN1" boardRef=".B1" />
    </assembly.device>,
  )
  await circuit.renderUntilSettled()
  const source = circuit.db.source_component.getWhere({ name: "EN1" })!
  const parts = circuit.db.cad_component
    .list()
    .filter((cad) => cad.source_component_id === source.source_component_id)
  expect(parts).toHaveLength(2)
  const origins: string[] = []
  let elevatedParts = 0
  for (const cad of parts) {
    const body = getEnclosureCadModelBody(undefined, cad)!
    if (body.bounds.min.z > 0) elevatedParts++
    const placement = getCadModelPlacement(cad, {
      nativeBounds: body.bounds,
      nativeToCanonicalModel: mat4.create(),
    })
    origins.push(placement.origin.provenance)
    const matrix = Array.from(placement.nativeToWorld)
    assertTransformMatrix(matrix)
    const [min, max] = jscad.measurements.measureAggregateBoundingBox(
      body.solids.map((solid) => jscad.transforms.transform(matrix, solid)),
    )
    for (const [axis, index] of [
      ["x", 0],
      ["y", 1],
      ["z", 2],
    ] as const) {
      expect(min[index]).toBeCloseTo(
        body.bounds.min[axis] + cad.position[axis],
        5,
      )
      expect(max[index]).toBeCloseTo(
        body.bounds.max[axis] + cad.position[axis],
        5,
      )
    }
  }
  expect(elevatedParts).toBeGreaterThan(0)
  expect(origins).toEqual(["explicit", "explicit"])
})
