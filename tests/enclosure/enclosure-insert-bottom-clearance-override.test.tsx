import { expect, test } from "bun:test"
import { measurements } from "@jscad/modeling"
import {
  enclosureReviewProbeVolume,
  getEnclosureReviewFastenerFixture,
} from "tests/fixtures/enclosure-review-fastener-fixture"

test("authored insert bottom clearance leaves empty bore below the emitted insert", async () => {
  const { shell, hardware, axisX } = await getEnclosureReviewFastenerFixture(
    import.meta.path,
    { insert: { bottomClearance: "9mm" } },
    "9mm free below insert",
  )
  const [insertBottom] = measurements.measureBoundingBox(
    hardware("heatsetinsert", "authored"),
  )
  expect(
    enclosureReviewProbeVolume(
      shell,
      [axisX("heatsetinsert", "authored"), insertBottom[1] - 4.5, 0],
      [0.2, 8.8, 0.2],
    ),
  ).toBeLessThan(1e-6)
}, 30_000)
