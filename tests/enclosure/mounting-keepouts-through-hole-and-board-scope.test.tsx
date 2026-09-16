import { expect, test } from "bun:test"
import { checkPcbCopperOverKeepout } from "@tscircuit/checks"
import { assembly, enclosure } from "lib"
import { getReferencedEnclosureBoard } from "lib/components/primitive-components/get-referenced-enclosure-board"
import { getTestFixture } from "tests/fixtures/get-test-fixture"

test("bottom mounting keepouts catch through-hole copper but never another board's footprint", async () => {
  const { circuit } = getTestFixture()
  circuit.add(
    <assembly.device>
      <board name="B1" width={40} height={24}>
        <hole name="H1" diameter={3.4}>
          <assembly.screw thread="m3" />
        </hole>
        <platedhole
          name="PTH"
          pcbX={3}
          holeDiameter={0.5}
          outerDiameter={1}
          shape="circle"
        />
      </board>
      {/* Coincident coordinates deliberately exercise ownership, not distance. */}
      <board name="B2" width={40} height={24}>
        <resistor
          name="OTHER_BOARD"
          resistance="1k"
          footprint="0402"
          layer="bottom"
          pcbX={3}
        />
      </board>
      <enclosure.fdm.box name="EN1" boardRef=".B1" standoffHeight={10} />
    </assembly.device>,
  )
  await circuit.renderUntilSettled()
  const board = getReferencedEnclosureBoard(circuit.firstChild!, ".B1")
  const boardJson = circuit.db
    .subtree({ subcircuit_id: board.subcircuit_id })
    .toArray()
  const copperErrors = checkPcbCopperOverKeepout(boardJson)
  expect(copperErrors).toHaveLength(1)
  expect(
    circuit.db.pcb_placement_error
      .list()
      .filter((error) => error.message === copperErrors[0]!.message),
  ).toHaveLength(1)
  expect(
    circuit.db.pcb_placement_error
      .list()
      .some(
        (error) =>
          error.message.includes("OTHER_BOARD") &&
          error.message.toLowerCase().includes("keepout"),
      ),
  ).toBe(false)
})
