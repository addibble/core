import { expect, test } from "bun:test"
import { getSolverWall } from "lib/components/primitive-components/EnclosureCutoutAperture/get-solver-wall"

test("solver walls preserve physical PCB wall names", () => {
  // Board walls and enclosure faces share one Cartesian vocabulary, so this is
  // an identity. Core once swapped the +Y and -Y walls here to compensate for a
  // renderer bug; this pins that it never does so again.
  expect(getSolverWall("y_pos")).toBe("y_pos")
  expect(getSolverWall("x_pos")).toBe("x_pos")
  expect(getSolverWall("y_neg")).toBe("y_neg")
  expect(getSolverWall("x_neg")).toBe("x_neg")
})
