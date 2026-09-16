import { expect, test } from "bun:test"
import {
  checkPcbComponentOverKeepout,
  checkPcbCopperOverKeepout,
} from "@tscircuit/checks"
import { convertCircuitJsonToPackOutput } from "calculate-packing"
import { Group } from "lib/components"
import { applyPackOutput } from "lib/components/primitive-components/Group/Group_doInitialPcbLayoutPack/applyPackOutput"
import { getTestFixture } from "tests/fixtures/get-test-fixture"

test("packed owned keepouts follow translation and quarter-turns without exempting owner copper", async () => {
  const { circuit } = getTestFixture()
  circuit.add(
    <board width={30} height={20} routingDisabled>
      <group name="PACK" pcbPack pcbX={0} pcbY={0}>
        <chip
          name="OWNER"
          footprint={
            <footprint>
              <smtpad shape="rect" width={1} height={1} portHints={["1"]} />
              <keepout shape="rect" width={6} height={2} />
            </footprint>
          }
        />
      </group>
      <pcbnotetext
        text="Owned keepout: 90 degree packed rotation; copper still checked"
        pcbY={-8}
        fontSize={0.6}
      />
    </board>,
  )
  await circuit.renderUntilSettled()
  const group = circuit.selectOne(".PACK")
  if (!(group instanceof Group)) throw new Error("Expected packing group")
  const keepout = circuit.db.pcb_keepout.list()[0]!
  if (keepout.shape !== "rect") throw new Error("Expected rectangular keepout")
  const ownerId = keepout.pcb_component_id!
  const owner = circuit.db.pcb_component.get(ownerId)!
  expect(owner.position_mode).toBe("packed")
  const previousSize = { width: keepout.width, height: keepout.height }
  const initialPackOutput = convertCircuitJsonToPackOutput(
    circuit.getCircuitJson(),
    {
      source_group_id: group.source_group_id ?? undefined,
    },
  )

  // Exercise the real packing application path with a deterministic quarter-turn
  // rather than relying on the solver's choice among equally good orientations.
  applyPackOutput(
    group,
    {
      ...initialPackOutput,
      components: initialPackOutput.components
        .filter((component) => component.componentId === ownerId)
        .map((component) => ({
          ...component,
          center: { x: 6, y: 4 },
          ccwRotationDegrees: 90,
        })),
    },
    {},
    initialPackOutput,
  )

  const moved = circuit.db.pcb_keepout.get(keepout.pcb_keepout_id)!
  if (moved.shape !== "rect") throw new Error("Expected moved rectangle")
  expect(moved.pcb_component_id).toBe(ownerId)
  expect(moved.center).toEqual({ x: 6, y: 4 })
  expect(moved.width).toBeCloseTo(previousSize.height)
  expect(moved.height).toBeCloseTo(previousSize.width)
  const pad = circuit.db.pcb_smtpad
    .list()
    .find((pad) => pad.pcb_component_id === ownerId)!
  if (pad.shape !== "rect") throw new Error("Expected rectangular pad")
  expect({ x: pad.x, y: pad.y }).toEqual(moved.center)
  expect(checkPcbComponentOverKeepout(circuit.getCircuitJson())).toHaveLength(0)
  expect(checkPcbCopperOverKeepout(circuit.getCircuitJson())).toHaveLength(1)
  await expect(circuit).toMatchPcbSnapshot(import.meta.path)
})
