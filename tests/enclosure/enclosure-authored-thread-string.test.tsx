import { expect, test } from "bun:test"
import type { CreateFdmEnclosureInput } from "@tscircuit/create-fdm-enclosure"
import { assembly, enclosure } from "lib"
import { getTestFixture } from "tests/fixtures/get-test-fixture"

test("core forwards authored screw and matching bolt/insert threads unchanged to solver validation", async () => {
  for (const kind of ["screw", "bolt"]) {
    for (const thread of ["m3", "m2.5", "m6", "M3", " m3 "]) {
      const { circuit } = getTestFixture()
      let input: CreateFdmEnclosureInput | undefined
      circuit.on("solver:started", (event) => {
        if (event.solverName === "CreateFdmEnclosureSolver")
          input = event.solverParams
      })
      circuit.add(
        <assembly.device>
          <board name="B1" width={40} height={30} routingDisabled>
            <hole name="H1" diameter={3.4}>
              {kind === "screw" ? (
                <assembly.screw thread={thread} />
              ) : (
                <>
                  <enclosure.fdm.heatsetinsert thread={thread} />
                  <assembly.bolt thread={thread} />
                </>
              )}
            </hole>
          </board>
          <enclosure.fdm.box name="EN1" boardRef=".B1" standoffHeight={12} />
        </assembly.device>,
      )
      if (thread === "m3" || thread === "m2.5") {
        await circuit.renderUntilSettled()
        expect(
          circuit.db.cad_component
            .list()
            .some((cad) =>
              cad.footprinter_string?.startsWith(`${kind}_${thread}_`),
            ),
        ).toBe(true)
      } else {
        await expect(circuit.renderUntilSettled()).rejects.toThrow(
          `EN1.H1: unknown assembly thread ${JSON.stringify(thread)}`,
        )
        expect(circuit.db.cad_component.list()).toHaveLength(0)
      }
      expect(input!.mounts![0]!.thread).toBe(thread)
    }
  }
})
