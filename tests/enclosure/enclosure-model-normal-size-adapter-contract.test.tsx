import { expect, test } from "bun:test"
import { getEnclosureReviewCollisionFixture } from "tests/fixtures/enclosure-review-collision-fixture"
import { getTestStaticAssetsServer } from "tests/fixtures/get-test-static-assets-server"

test("core projects a y-normal model's authored size into the solver's board-plane envelope", async () => {
  const assets = getTestStaticAssetsServer()
  const { solverInput } = await getEnclosureReviewCollisionFixture({
    cadModel: {
      objUrl: `${assets.url}/models/enclosure-review-y-normal-body.obj`,
      size: { x: 6, y: 4, z: 20 },
      modelBoardNormalDirection: "y+",
      modelOriginPosition: { x: 0, y: 0, z: 0 },
      modelBounds: {
        min: { x: -3, y: 0, z: -10 },
        max: { x: 3, y: 4, z: 10 },
      },
    },
    mount: { x: 0, y: 8 },
  })
  const component = solverInput.components?.find((component) =>
    component.id.includes("U1"),
  )

  // Authored physical dimensions: 6mm across, 20mm along the board, 4mm
  // outward from its bottom face. Do not use the exporter's resized mesh as
  // an oracle for this Core-to-solver contract; size.z is only a fallback.
  expect(component?.boardSide).toBe("bottom")
  expect(component?.body.aboveBoardHeight).toBe(4)
  expect(component?.body.size?.x).toBe(6)
  expect(component?.body.size?.y).toBe(20)
})
