import { expect, test } from "bun:test"
import { getEnclosureReviewCollisionFixture } from "tests/fixtures/enclosure-review-collision-fixture"

test("an overhanging model anchors at its measured board contact patch, not its full bounding-box center", async () => {
  const { solverInput } = await getEnclosureReviewCollisionFixture({
    cadModel: {
      jscad: {
        type: "union",
        shapes: [
          { type: "cuboid", size: [12, 8, 2], center: [0, 0, 3] },
          { type: "cuboid", size: [2, 2, 2], center: [4, 0, 1] },
        ],
      },
      positionOffset: { x: 12, y: 0, z: 0 },
    },
    mount: { x: -12, y: -8 },
  })
  const body = solverInput.components!.find((component) =>
    component.id.includes("U1"),
  )!
  // The native contact patch centers at +4X. The bottom Y-flip places the
  // overhanging body's center 4mm to the RIGHT of its emitted contact datum.
  expect(body.center.x).toBeCloseTo(16, 5)
  expect(body.center.y).toBeCloseTo(0, 5)
  expect(body.body.size?.x).toBeCloseTo(12, 5)
  expect(body.body.aboveBoardHeight).toBeCloseTo(4, 5)
})
