import { expect, test } from "bun:test"
import { getMountingKeepoutFixture } from "tests/fixtures/mounting-keepout-fixture"

test("authored zero and unit-bearing margins change actual generated support radii", async () => {
  for (const [margin, expected] of [
    [0, 0],
    ["0.2cm", 2],
  ] as const) {
    const { generatedKeepouts, solverOutput, solverInput } =
      await getMountingKeepoutFixture({ mountingKeepoutMargin: margin })
    const keepout = generatedKeepouts()[0]
    if (keepout?.shape !== "circle")
      throw new Error("Expected circular keepout")
    expect(solverInput.mountingKeepoutMargin).toBe(expected)
    expect(keepout.radius).toBeCloseTo(
      solverOutput.mounts[0]!.bossDiameterMm / 2 + expected,
    )
  }
})
