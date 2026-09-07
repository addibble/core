import { expect, test } from "bun:test"
import { measurements } from "@jscad/modeling"
import { join } from "node:path"
import { getEnclosureReviewCollisionFixture } from "tests/fixtures/enclosure-review-collision-fixture"
import { writeEnclosureReviewGeometry } from "tests/fixtures/enclosure-review-geometry"

test("a solver error that prevents board seating reaches Circuit JSON diagnostics", async () => {
  const { circuitJson, solverOutput } =
    await getEnclosureReviewCollisionFixture()
  const geometry = await writeEnclosureReviewGeometry({
    circuitJson,
    testPath: import.meta.path,
    section: { center: [0, -3, 0], size: [18, 20, 0.6] },
    collision: { first: "U1", second: "EN1" },
    caption: "RED = body/boss intersection; board cannot seat",
  })
  await Bun.write(
    join(geometry.directory, "solver-violations.json"),
    JSON.stringify(solverOutput.designRuleViolations, null, 2),
  )
  expect(measurements.measureVolume(geometry.overlap!)).toBeGreaterThan(1)
  const violation = solverOutput.designRuleViolations.find(
    (violation) =>
      violation.rule === "component_clearance" &&
      violation.severity === "error",
  )
  expect(violation).toMatchObject({ mountId: "EN1.H1" })
  expect(violation?.measuredMm).toBeLessThan(0)
  expect(violation?.message).toContain("The board cannot seat")
  const mechanicalErrors = circuitJson.filter(
    (element) =>
      element.type.includes("error") &&
      "message" in element &&
      typeof element.message === "string" &&
      element.message.includes("EN1.H1") &&
      element.message.includes("U1") &&
      element.message.includes("cannot seat"),
  )
  expect(mechanicalErrors).toHaveLength(1)
}, 30_000)
