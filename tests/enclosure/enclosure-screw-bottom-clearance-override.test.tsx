import { expect, test } from "bun:test"
import { measurements } from "@jscad/modeling"
import {
  enclosureReviewProbeVolume,
  getEnclosureReviewFastenerFixture,
} from "tests/fixtures/enclosure-review-fastener-fixture"

test("authored screw bottom clearance leaves empty bore below the emitted tip", async () => {
  const { shell, hardware, axisX } = await getEnclosureReviewFastenerFixture(
    import.meta.path,
    { screw: { bottomClearance: "9mm" } },
    "9mm free below screw tip",
  )
  const [tip] = measurements.measureBoundingBox(hardware("screw", "authored"))
  // The probe stops short of both endpoints, so coplanar faces cannot decide it.
  expect(
    enclosureReviewProbeVolume(
      shell,
      [axisX("screw", "authored"), tip[1] - 4.5, 0],
      [0.2, 8.8, 0.2],
    ),
  ).toBeLessThan(1e-6)
}, 30_000)
