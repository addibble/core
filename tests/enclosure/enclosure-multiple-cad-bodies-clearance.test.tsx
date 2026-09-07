import { expect, test } from "bun:test"
import { getEnclosureReviewCollisionFixture } from "tests/fixtures/enclosure-review-collision-fixture"
import { getTestStaticAssetsServer } from "tests/fixtures/get-test-static-assets-server"

test("a second offset CAD solid reaches clearance checks without merging conservative bodies into it", async () => {
  const assets = getTestStaticAssetsServer()
  const { circuit, solverInput, solverOutput } =
    await getEnclosureReviewCollisionFixture({
      mount: { x: 8, y: 0 },
      cadModel: (
        <cadassembly>
          <cadmodel
            modelUrl={`${assets.url}/models/enclosure-review-y-normal-body.obj`}
            positionOffset={{ x: -8, y: 0, z: 0 }}
            modelBoardNormalDirection="y+"
            modelOriginPosition={{ x: 0, y: 0, z: 0 }}
          />
          <cadmodel
            modelUrl={`${assets.url}/models/enclosure-review-y-normal-body.obj`}
            positionOffset={{ x: 8, y: 0, z: 0 }}
            modelBoardNormalDirection="y+"
            modelOriginPosition={{ x: 0, y: 0, z: 0 }}
          />
          <cadmodel
            modelUrl="https://example.com/unloaded-body.step"
            modelOriginPosition={{ x: 0, y: 0, z: 0 }}
            modelBounds={{
              min: { x: -2, y: -2, z: 0 },
              max: { x: 2, y: 2, z: 2 },
            }}
          />
        </cadassembly>
      ),
    })
  const collisions = solverOutput.designRuleViolations.filter(
    (violation) =>
      violation.rule === "component_clearance" &&
      violation.severity === "error" &&
      violation.componentId?.includes("U1"),
  )
  expect(collisions).toHaveLength(1)
  expect(collisions[0]!.measuredMm).toBeLessThan(0)

  const bodies = solverInput
    .components!.filter((component) => component.id.includes("U1"))
    .sort((a, b) => a.center.x - b.center.x)
  expect(bodies).toHaveLength(3)
  expect(new Set(bodies.map((body) => body.id)).size).toBe(3)
  expect(bodies[0]!.center.x).toBeCloseTo(-8, 6)
  expect(bodies[0]!.solid?.type).toBe("jscad")
  expect(bodies[1]!.center.x).toBeCloseTo(0, 6)
  expect(bodies[1]!.solid).toBeUndefined()
  expect(bodies[1]!.body.size?.x).toBeCloseTo(4, 6)
  expect(bodies[1]!.body.size?.y).toBeCloseTo(4, 6)
  expect(bodies[1]!.body.size?.z).toBeCloseTo(2, 6)
  expect(bodies[2]!.center.x).toBeCloseTo(8, 6)
  expect(bodies[2]!.solid?.type).toBe("jscad")
  expect(collisions[0]!.componentId).toBe(bodies[2]!.id)

  const source = circuit.db.source_component.getWhere({ name: "U1" })!
  const cadRecords = circuit.db.cad_component
    .list()
    .filter((cad) => cad.source_component_id === source.source_component_id)
  expect(cadRecords).toHaveLength(3)
  for (const cad of cadRecords) {
    expect(bodies.some((body) => body.id.includes(cad.cad_component_id))).toBe(
      true,
    )
  }
})
