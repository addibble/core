import { expect, test } from "bun:test"
import {
  enclosureReviewProbeVolume,
  getEnclosureReviewFastenerFixture,
} from "tests/fixtures/enclosure-review-fastener-fixture"

test("authored screw chamfer ratio cuts a 45-degree entry in the emitted boss", async () => {
  const { shell, boardBottomY, axisX } =
    await getEnclosureReviewFastenerFixture(
      import.meta.path,
      { screw: { boreEntryChamfer: 1.6 } },
      "1.6x 2.5mm pilot bore (4mm mouth)",
    )
  // Bore-relative: 1.6 * 2.5 = 4mm. At 0.15mm depth the mouth reaches 1.85mm.
  expect(
    enclosureReviewProbeVolume(
      shell,
      [axisX("screw", "authored") + 1.7, boardBottomY - 0.15, 0],
      [0.1, 0.1, 0.1],
    ),
  ).toBeLessThan(1e-6)
}, 30_000)
