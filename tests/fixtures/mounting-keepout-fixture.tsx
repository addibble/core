import {
  createFdmEnclosure,
  type CreateFdmEnclosureInput,
} from "@tscircuit/create-fdm-enclosure"
import type { EnclosureFdmBoxProps } from "@tscircuit/props"
import { assembly, enclosure } from "lib"
import { getTestFixture } from "./get-test-fixture"

export const getMountingKeepoutFixture = async ({
  kind = "screw",
  mountingKeepoutMargin,
  boardX = 100,
  boardY = 200,
}: {
  kind?: "screw" | "bolt" | "column" | "spacer"
  mountingKeepoutMargin?: EnclosureFdmBoxProps["mountingKeepoutMargin"]
  boardX?: number
  boardY?: number
} = {}) => {
  const { circuit } = getTestFixture()
  let solverInput: CreateFdmEnclosureInput | undefined
  let solveCount = 0
  circuit.on("solver:started", (event) => {
    if (event.solverName !== "CreateFdmEnclosureSolver") return
    solverInput = event.solverParams
    solveCount++
  })
  circuit.add(
    <assembly.device name="DEVICE">
      {/* Enclosure intentionally precedes its board in authoring order. */}
      <enclosure.fdm.box
        name="EN1"
        boardRef=".B1"
        standoffHeight={10}
        topHeadroom={8}
        mountingKeepoutMargin={mountingKeepoutMargin}
      />
      <board
        name="B1"
        width={40}
        height={24}
        pcbX={boardX}
        pcbY={boardY}
        schMaxTraceDistance={0}
      >
        <hole name="H1" diameter={3.4}>
          {kind === "screw" ? (
            <assembly.screw thread="m3" />
          ) : (
            <enclosure.fdm.heatsetinsert thread="m3" />
          )}
        </hole>
        {(["top", "bottom"] as const).map((layer) => (
          <chip
            key={layer}
            name={layer === "top" ? "TOP" : "BOTTOM"}
            layer={layer}
            pcbX={3}
            footprint={
              <footprint>
                <smtpad
                  portHints={["1"]}
                  pcbX={0}
                  pcbY={0}
                  width={0.8}
                  height={0.8}
                  shape="rect"
                />
              </footprint>
            }
          />
        ))}
        <keepout shape="circle" radius={1} pcbX={-12} pcbY={-8} />
      </board>
      {kind !== "screw" && (
        <assembly.bolt
          thread="m3"
          holeRef=".B1 .H1"
          fastensLid={kind !== "bolt"}
          lidColumn={kind === "spacer" ? "spacer" : kind === "column"}
        />
      )}
    </assembly.device>,
  )
  await circuit.renderUntilSettled()
  if (!solverInput) throw new Error("Expected an actual enclosure solve")
  return {
    circuit,
    solverInput,
    solverOutput: createFdmEnclosure(solverInput),
    getSolveCount: () => solveCount,
    generatedKeepouts: () =>
      circuit.db.pcb_keepout.list().filter((keepout) => keepout.description),
  }
}
