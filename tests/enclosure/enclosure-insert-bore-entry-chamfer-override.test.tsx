import { expect, test } from "bun:test"
import {
  enclosureReviewProbeVolume,
  getEnclosureReviewFastenerFixture,
} from "tests/fixtures/enclosure-review-fastener-fixture"

test("authored insert chamfer ratio cuts the requested entry in the emitted boss", async () => {
  const { shell, boardBottomY, axisX } =
    await getEnclosureReviewFastenerFixture(
      import.meta.path,
      { insert: { boreEntryChamfer: 1.4 } },
      "1.4x 4mm installation bore (5.6mm mouth)",
    )
  // 1.4 * 4 = 5.6mm, so the 45-degree mouth reaches 2.65mm at this depth.
  // A nominal-thread interpretation (4.2mm mouth) would leave this probe solid.
  expect(
    enclosureReviewProbeVolume(
      shell,
      [axisX("heatsetinsert", "authored") + 2.5, boardBottomY - 0.15, 0],
      [0.1, 0.1, 0.1],
    ),
  ).toBeLessThan(1e-6)
}, 30_000)
