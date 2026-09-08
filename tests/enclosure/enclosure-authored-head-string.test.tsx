import { expect, test } from "bun:test"
import type { CreateFdmEnclosureInput } from "@tscircuit/create-fdm-enclosure"
import { assembly, enclosure } from "lib"
import { getTestFixture } from "tests/fixtures/get-test-fixture"

test("core forwards screw and bolt head strings and omission to downstream validation", () => {
  for (const kind of ["screw", "bolt"]) {
    for (const head of [undefined, "panhead", "future_head", "flathead"]) {
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
                <assembly.screw thread="m3" head={head} />
              ) : (
                <>
                  <enclosure.fdm.heatsetinsert thread="m3" />
                  <assembly.bolt thread="m3" head={head} />
                </>
              )}
            </hole>
          </board>
          <enclosure.fdm.box name="EN1" boardRef=".B1" standoffHeight={12} />
        </assembly.device>,
      )
      if (head === "future_head" || head === "flathead") {
        expect(() => circuit.render()).toThrow("EN1.H1")
        expect(circuit.db.cad_component.list()).toHaveLength(0)
      } else {
        circuit.render()
        expect(
          circuit.db.cad_component
            .list()
            .some((cad) =>
              cad.footprinter_string?.includes(head ?? "socketcap"),
            ),
        ).toBe(true)
      }
      expect(input!.mounts![0]!.head).toBe(head)
    }
  }
})
