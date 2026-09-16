import { expect, test } from "bun:test"
import { getMountingKeepoutFixture } from "tests/fixtures/mounting-keepout-fixture"

test("authored zero and unit-bearing margins change actual generated support radii", async () => {
  for (const [margin, expected] of [
    [0, 0],
    ["0.2cm", 2],
  ] as const) {
    const { generatedKeepouts, solverOutput, solverInput } =
      await getMountingKeepoutFixture({ mountingKeepoutMargin: margin })
    const keepout = generatedKeepouts().find((keepout) =>
      keepout.layers.includes("bottom"),
    )
    if (keepout?.shape !== "circle")
      throw new Error("Expected circular keepout")
    expect(solverInput.mountingKeepoutMargin).toBe(expected)
    expect(keepout.radius).toBeCloseTo(
      solverOutput.mounts[0]!.bossDiameterMm / 2 + expected,
    )
    const head = generatedKeepouts().find((keepout) =>
      keepout.layers.includes("top"),
    )
    if (head?.shape !== "circle") throw new Error("Expected head keepout")
    expect(head.radius).toBeCloseTo(
      solverOutput.mounts[0]!.fastener.head.diameterMm / 2 + expected,
    )
  }
})
