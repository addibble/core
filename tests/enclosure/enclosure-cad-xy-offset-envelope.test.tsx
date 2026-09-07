import { expect, test } from "bun:test"
import { measurements } from "@jscad/modeling"
import {
  enclosureReviewBlock,
  getEnclosureReviewCollisionFixture,
} from "tests/fixtures/enclosure-review-collision-fixture"
import { writeEnclosureReviewGeometry } from "tests/fixtures/enclosure-review-geometry"

test("the solver envelope follows the emitted CAD body's XY offset, not its pads", async () => {
  const { circuitJson, solverInput, solverOutput } =
    await getEnclosureReviewCollisionFixture({
      cadModel: {
        ...enclosureReviewBlock,
        positionOffset: { x: 12, y: 4, z: 0 },
      },
      mount: { x: 12, y: 4 },
    })
  const geometry = await writeEnclosureReviewGeometry({
    circuitJson,
    testPath: import.meta.path,
    section: { center: [-12, -3, 4], size: [18, 20, 0.6] },
    collision: { first: "U1", second: "EN1" },
    caption: "CAD offset (+12,+4); RED = missed boss collision",
    evidence: { solverInput, violations: solverOutput.designRuleViolations },
  })
  expect(measurements.measureVolume(geometry.overlap!)).toBeGreaterThan(1)
  const cadBody = circuitJson.find(
    (element) => element.type === "cad_component" && element.size?.x === 6,
  )
  if (!cadBody || cadBody.type !== "cad_component")
    throw new Error("Missing U1 CAD body")
  const component = solverInput.components?.find((component) =>
    component.id.includes("U1"),
  )
  // This body is symmetric about its emitted anchor. Compare board-frame
  // records, not glTF's final X-reflected world against the solver's board X.
  expect(component?.center).toEqual({
    x: cadBody.position.x,
    y: cadBody.position.y,
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
