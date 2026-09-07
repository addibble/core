import { expect, test } from "bun:test"
import {
  enclosureReviewProbeVolume,
  getEnclosureReviewFastenerFixture,
} from "tests/fixtures/enclosure-review-fastener-fixture"

test("authored insert chamfer ratio cuts the requested entry in the emitted boss", async () => {
  const { shell, boardBottomY, axisX } =
    await getEnclosureReviewFastenerFixture(
      import.meta.path,
      { insert: { boreEntryChamfer: 2 } },
      "2x M3 chamfer (6mm mouth)",
    )
  // The standard M3 install bore is narrower than this point; a 6mm mouth at
  // 45 degrees removes it. The deliberately different ratio distinguishes it.
  expect(
    enclosureReviewProbeVolume(
      shell,
      [axisX("heatsetinsert", "authored") + 2.65, boardBottomY - 0.15, 0],
      [0.1, 0.1, 0.1],
    ),
  ).toBeLessThan(1e-6)
}, 30_000)
