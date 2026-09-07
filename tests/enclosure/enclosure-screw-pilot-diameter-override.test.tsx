import { expect, test } from "bun:test"
import {
  enclosureReviewProbeVolume,
  getEnclosureReviewFastenerFixture,
} from "tests/fixtures/enclosure-review-fastener-fixture"

test("authored pilot diameter removes plastic out to the requested bore radius", async () => {
  const { shell, boardBottomY, axisX } =
    await getEnclosureReviewFastenerFixture(
      import.meta.path,
      { screw: { pilotDiameter: "2.8mm" } },
      "2.8mm pilot bore",
    )
  // This strip is outside the default 1.25mm radius, inside authored 1.4mm.
  const size: [number, number, number] = [0.06, 0.2, 0.06]
  expect(
    enclosureReviewProbeVolume(
      shell,
      [axisX("screw", "control") + 1.32, boardBottomY - 2, 0],
      size,
    ),
  ).toBeGreaterThan(0.0005)
  expect(
    enclosureReviewProbeVolume(
      shell,
      [axisX("screw", "authored") + 1.32, boardBottomY - 2, 0],
      size,
    ),
  ).toBeLessThan(1e-6)
}, 30_000)
