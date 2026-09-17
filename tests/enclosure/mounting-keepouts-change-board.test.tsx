import { expect, test } from "bun:test"
import { assembly, enclosure } from "lib"
import { EnclosureFdmBox } from "lib/components"
import { Fragment } from "react"
import { getReferencedEnclosureBoard } from "lib/components/primitive-components/get-referenced-enclosure-board"
import { getTestFixture } from "tests/fixtures/get-test-fixture"

test("retargeting an enclosure refreshes mounting footprint diagnostics on both boards", async () => {
  const { circuit } = getTestFixture()
  circuit.add(
    <assembly.device>
      {(["FIRST", "SECOND"] as const).map((name, index) => (
        <board
          key={name}
          name={`B${index + 1}`}
          width={40}
          height={24}
          pcbX={index * 70}
        >
          <hole name={`H${index + 1}`} diameter={3.4}>
            <assembly.screw thread="m3" />
          </hole>
          <chip
            name={name}
            layer="bottom"
            footprint={
              <footprint>
                {[-9, 9].map((pcbX, pin) => (
                  <Fragment key={pcbX}>
                    <smtpad
                      portHints={[String(pin + 1)]}
                      pcbX={pcbX}
                      width={0.8}
                      height={0.8}
                      shape="rect"
                    />
                  </Fragment>
                ))}
              </footprint>
            }
          />
        </board>
      ))}
      <enclosure.fdm.box name="EN1" boardRef=".B1" standoffHeight={10} />
    </assembly.device>,
  )
  await circuit.renderUntilSettled()
  const enclosureBox = circuit.selectOne(".EN1")
  if (!(enclosureBox instanceof EnclosureFdmBox))
    throw new Error("Expected enclosure instance")
  const mountingErrors = () =>
    circuit.db.pcb_placement_error
      .list()
      .filter((error) => error.message.includes("keepout"))
  expect(mountingErrors()).toHaveLength(1)
  expect(mountingErrors()[0]!.message).toContain("FIRST")
  enclosureBox.setProps({ boardRef: ".B2" })
  await circuit.renderUntilSettled()
  expect(mountingErrors()).toHaveLength(1)
  expect(mountingErrors()[0]!.message).toContain("SECOND")
  const board = getReferencedEnclosureBoard(circuit.firstChild!, ".B2")
  expect(enclosureBox.generatedForBoard).toBe(board)
  for (const keepout of circuit.db.pcb_keepout.list()) {
    expect(keepout.subcircuit_id).toBe(board.subcircuit_id ?? undefined)
    if (keepout.shape !== "circle") throw new Error("Expected mounting circle")
    expect(keepout.center.x).toBe(70)
  }
})
