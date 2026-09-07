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
      "1.6x M3 chamfer (4.8mm mouth)",
    )
  // At 0.15mm depth the requested 45-degree mouth reaches radius 2.25mm.
  expect(
    enclosureReviewProbeVolume(
      shell,
      [axisX("screw", "authored") + 2, boardBottomY - 0.15, 0],
      [0.1, 0.1, 0.1],
    ),
  ).toBeLessThan(1e-6)
}, 30_000)
