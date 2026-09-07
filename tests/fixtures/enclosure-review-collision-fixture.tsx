import {
  CreateFdmEnclosureSolver,
  type CreateFdmEnclosureInput,
} from "@tscircuit/create-fdm-enclosure"
import type { CadModelProp } from "@tscircuit/props"
import { assembly, enclosure } from "lib"
import { getTestFixture } from "./get-test-fixture"

/** Model-local right-handed Z-up mm; the origin is the board contact point. */
export const enclosureReviewBlock = {
  jscad: {
    type: "colorize",
    color: [0.1, 0.35, 0.9, 1],
    shape: { type: "cuboid", size: [6, 6, 4], center: [0, 0, 2] },
  },
  size: { x: 6, y: 6, z: 4 },
  modelOriginPosition: { x: 0, y: 0, z: 0 },
  modelBounds: {
    min: { x: -3, y: -3, z: 0 },
    max: { x: 3, y: 3, z: 4 },
  },
} satisfies CadModelProp

/** Mount anchor is a board-relative XY point in mm, with Circuit JSON +Z up. */
export const getEnclosureReviewCollisionFixture = async ({
  cadModel = enclosureReviewBlock,
  mount = { x: 0, y: 0 },
}: {
  cadModel?: CadModelProp
  mount?: { x: number; y: number }
} = {}) => {
  const { circuit } = getTestFixture()
  let solverInput: CreateFdmEnclosureInput | undefined
  circuit.on("solver:started", (event) => {
    if (event.solverName === "CreateFdmEnclosureSolver") {
      solverInput = event.solverParams as CreateFdmEnclosureInput
    }
  })
  circuit.add(
    <assembly.device name="DEVICE">
      <board name="B1" width={40} height={32} thickness={1.6} routingDisabled>
        <chip
          name="U1"
          layer="bottom"
          cadModel={cadModel}
          footprint={
            <footprint>
              <smtpad portHints={["1"]} shape="rect" width={0.5} height={0.5} />
            </footprint>
          }
        />
        <hole name="H1" pcbX={mount.x} pcbY={mount.y} diameter={3.4}>
          <assembly.screw thread="m3" />
        </hole>
      </board>
      <enclosure.fdm.box name="EN1" boardRef=".B1" standoffHeight={8} />
    </assembly.device>,
  )
  await circuit.renderUntilSettled()
  if (!solverInput) throw new Error("Core did not start the enclosure solver")
  // Replay exactly Core's public solver event, not a test-constructed envelope.
  const solver = new CreateFdmEnclosureSolver(solverInput)
  solver.solve()
  if (solver.failed) throw new Error(solver.error ?? "Enclosure solver failed")
  return {
    circuit,
    circuitJson: await circuit.getCircuitJson(),
    solverInput,
    solverOutput: solver.getOutput(),
  }
}
