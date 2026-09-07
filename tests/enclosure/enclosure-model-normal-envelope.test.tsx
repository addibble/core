import { expect, test } from "bun:test"
import { measurements } from "@jscad/modeling"
import { getEnclosureReviewCollisionFixture } from "tests/fixtures/enclosure-review-collision-fixture"
import { writeEnclosureReviewGeometry } from "tests/fixtures/enclosure-review-geometry"
import { getTestStaticAssetsServer } from "tests/fixtures/get-test-static-assets-server"

test("a y-normal model's emitted board-space body is contained by its solver envelope", async () => {
  const assets = getTestStaticAssetsServer()
  const { circuitJson, solverInput, solverOutput } =
    await getEnclosureReviewCollisionFixture({
      cadModel: {
        objUrl: `${assets.url}/models/enclosure-review-y-normal-body.obj`,
        modelBoardNormalDirection: "y+",
        modelOriginPosition: { x: 0, y: 0, z: 0 },
        // Measured bounds, without requesting the exporter's additional object-fit
        // resize. The asset's long Z dimension lies along board Y, not its normal.
        modelBounds: {
          min: { x: -3, y: 0, z: -10 },
          max: { x: 3, y: 4, z: 10 },
        },
      },
      mount: { x: 0, y: 8 },
    })
  const geometry = await writeEnclosureReviewGeometry({
    circuitJson,
    testPath: import.meta.path,
    section: { center: [0, -3, 8], size: [18, 20, 0.6] },
    collision: { first: "U1", second: "EN1" },
    caption: "Model +Y normal; RED = boss inside long board-Y body",
    evidence: { solverInput, violations: solverOutput.designRuleViolations },
  })
  const [min, max] = measurements.measureBoundingBox(geometry.solidNamed("U1"))
  // Establish the physical repro from the exported mesh before testing Core.
  expect(max[0] - min[0]).toBeCloseTo(6)
  expect(max[2] - min[2]).toBeCloseTo(20)
  expect(max[1] - min[1]).toBeCloseTo(4)
  expect(measurements.measureVolume(geometry.overlap!)).toBeGreaterThan(1)
  const component = solverInput.components?.find((component) =>
    component.id.includes("U1"),
  )
  expect(component?.body).toMatchObject({
    size: {
      x: max[0] - min[0],
      y: max[2] - min[2],
    },
    aboveBoardHeight: max[1] - min[1],
  })
  expect(solverOutput.designRuleViolations).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        rule: "component_clearance",
        severity: "error",
        mountId: "EN1.H1",
      }),
    ]),
  )
}, 30_000)
