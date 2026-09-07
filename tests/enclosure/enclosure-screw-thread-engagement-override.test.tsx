import { expect, test } from "bun:test"
import { measurements } from "@jscad/modeling"
import { getEnclosureReviewFastenerFixture } from "tests/fixtures/enclosure-review-fastener-fixture"

test("authored thread engagement controls the emitted screw's reach into the boss", async () => {
  const { hardware, boardBottomY } = await getEnclosureReviewFastenerFixture(
    import.meta.path,
    { screw: { threadEngagement: "12mm" } },
    "12mm engagement",
  )
  const [controlMin] = measurements.measureBoundingBox(
    hardware("screw", "control"),
  )
  const [authoredMin] = measurements.measureBoundingBox(
    hardware("screw", "authored"),
  )
  expect(boardBottomY - controlMin[1]).toBeLessThan(12)
  expect(boardBottomY - authoredMin[1]).toBeGreaterThanOrEqual(12 - 1e-4)
}, 30_000)
