import { expect, test } from "bun:test"
import {
  enclosureReviewBlock,
  getEnclosureReviewCollisionFixture,
} from "tests/fixtures/enclosure-review-collision-fixture"

test("single-model and model-free components retain their existing solver identities", async () => {
  for (const cadModel of [null, enclosureReviewBlock]) {
    const { circuit, solverInput } = await getEnclosureReviewCollisionFixture({
      cadModel,
      mount: { x: 12, y: 0 },
    })
    const owner = circuit
      .firstChild!.getDescendants()
      .find((descendant) => descendant.name === "U1")!
    const bodies = solverInput.components!.filter((component) =>
      component.id.includes("U1"),
    )
    expect(bodies).toHaveLength(1)
    expect(bodies[0]!.id).toBe(owner.getString())
    if (cadModel === null) {
      expect(bodies[0]!.solid).toBeUndefined()
      expect(bodies[0]!.body.footprint).toEqual({ width: 0.5, height: 0.5 })
    } else {
      expect(bodies[0]!.solid?.type).toBe("jscad")
    }
  }
})
