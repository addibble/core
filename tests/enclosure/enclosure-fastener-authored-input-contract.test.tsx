import { expect, test } from "bun:test"
import type { CreateFdmEnclosureInput } from "@tscircuit/create-fdm-enclosure"
import { assembly, enclosure } from "lib"
import { getTestFixture } from "tests/fixtures/get-test-fixture"

test("all six mechanical overrides reach solver policy as parsed intent, including zero and omission", () => {
  const { circuit } = getTestFixture()
  let input: CreateFdmEnclosureInput | undefined
  circuit.on("solver:started", (event) => {
    if (event.solverName === "CreateFdmEnclosureSolver")
      input = event.solverParams
  })
  circuit.add(
    <assembly.device>
      <board name="B1" width={60} height={30} thickness={1.6} routingDisabled>
        <hole name="DEFAULT" pcbX={-20} diameter={3.4}>
          <assembly.screw thread="m3" />
        </hole>
        <hole name="SCREW" diameter={3.4}>
          <assembly.screw
            thread="m3"
            threadEngagement="0.6cm"
            pilotDiameter="2800um"
            bottomClearance={0}
            boreEntryChamfer={1}
          />
        </hole>
        <hole name="INSERT" pcbX={20} diameter={3.4}>
          <enclosure.fdm.heatsetinsert
            thread="m3"
            bottomClearance="0.2cm"
            boreEntryChamfer={1.4}
          />
          <assembly.bolt thread="m3" />
        </hole>
      </board>
      <enclosure.fdm.box name="EN1" boardRef=".B1" standoffHeight={24} />
    </assembly.device>,
  )
  circuit.render()
  const omitted = input!.mounts!.find((mount) => mount.id === "EN1.DEFAULT")!
  const screw = input!.mounts!.find((mount) => mount.id === "EN1.SCREW")!
  const insert = input!.mounts!.find((mount) => mount.id === "EN1.INSERT")!
  for (const field of [
    "threadEngagement",
    "pilotDiameter",
    "bottomClearance",
    "boreEntryChamfer",
    "insertBottomClearance",
    "insertBoreEntryChamfer",
  ] as const) {
    expect(omitted[field]).toBeUndefined()
  }
  expect(screw.threadEngagement).toBe(6)
  expect(screw.pilotDiameter).toBeCloseTo(2.8)
  expect(screw.bottomClearance).toBe(0)
  expect(screw.boreEntryChamfer).toBe(1)
  expect(insert.insertBottomClearance).toBe(2)
  expect(insert.insertBoreEntryChamfer).toBe(1.4)
  expect(insert.bottomClearance).toBeUndefined()
  expect(insert.boreEntryChamfer).toBeUndefined()
})
