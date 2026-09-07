import { expect, test } from "bun:test"
import { booleans, measurements, primitives, transforms } from "@jscad/modeling"
import { getEnclosureReviewCollisionFixture } from "tests/fixtures/enclosure-review-collision-fixture"
import { getEnclosureCadModelBody } from "lib/components/primitive-components/get-enclosure-cad-model-body"

test("a boss inside an actual body opening is not a collision merely because their AABBs overlap", async () => {
  const { circuit, solverInput, solverOutput } =
    await getEnclosureReviewCollisionFixture({
      cadModel: {
        jscad: {
          type: "subtract",
          shapes: [
            { type: "cuboid", size: [12, 12, 4], center: [0, 0, 2] },
            {
              type: "cylinder",
              radius: 4.5,
              height: 6,
              center: [0, 0, 2],
              segments: 16,
            },
          ],
        },
        modelOriginPosition: { x: 0, y: 0, z: 0 },
      },
    })
  const component = solverInput.components?.find((c) => c.id.includes("U1"))
  expect(component?.body.size?.x).toBeCloseTo(12)
  expect(component?.body.size?.y).toBeCloseTo(12)
  const solid = component?.solid
  if (solid?.type !== "jscad" || solid.jscadPlan.type !== "transform") {
    throw new Error("Expected the native body with its single placement matrix")
  }
  const source = circuit.db.source_component.getWhere({ name: "U1" })!
  const cad = circuit.db.cad_component.getWhere({
    source_component_id: source.source_component_id,
  })!
  const nativeBody = getEnclosureCadModelBody(undefined, cad)!
  const bodySolid = transforms.transform(
    solid.jscadPlan.matrix,
    nativeBody.solids[0]!,
  )
  const bossProbe = primitives.cylinder({
    radius: 3,
    height: 4,
    center: [0, 0, -2.8],
  })
  expect(
    measurements.measureVolume(booleans.intersect(bodySolid, bossProbe)),
  ).toBeLessThan(1e-6)
  expect(
    solverOutput.designRuleViolations.filter(
      (v) => v.rule === "component_clearance" && v.message.includes("U1"),
    ),
  ).toHaveLength(0)
}, 30_000)
