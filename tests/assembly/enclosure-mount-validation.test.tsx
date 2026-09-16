import { expect, test } from "bun:test"
import { createFdmEnclosure } from "@tscircuit/create-fdm-enclosure"
import { assembly, enclosure } from "lib"
import { getTestFixture } from "tests/fixtures/get-test-fixture"

const mount = (children: React.ReactNode) => (
  <assembly.device name="DEV1">
    <board name="B1" width="40mm" height="24mm">
      <hole name="H1" pcbX={-8} pcbY={0} diameter="3.4mm">
        {children}
      </hole>
    </board>
    <enclosure.fdm.box name="EN1" boardRef=".B1" standoffHeight={8} />
  </assembly.device>
)

const renderFailure = async (tree: React.ReactNode): Promise<string> => {
  const { circuit } = getTestFixture()
  circuit.add(tree as never)
  try {
    await circuit.renderUntilSettled()
  } catch (e) {
    return String(e)
  }
  return ""
}

test("a bolt with nothing to thread into is refused", async () => {
  const message = await renderFailure(mount(<assembly.bolt thread="m3" />))
  expect(message).toContain('hole "H1"')
  expect(message).toContain("nothing for it to thread into")
})

test("an insert with no bolt going into it is refused", async () => {
  const message = await renderFailure(
    mount(<enclosure.fdm.heatsetinsert thread="m3" />),
  )
  expect(message).toContain('hole "H1"')
  expect(message).toContain("no <assembly.bolt />")
})

test("a screw and a bolt on one hole are refused", async () => {
  const message = await renderFailure(
    mount(
      <>
        <assembly.screw thread="m3" />
        <assembly.bolt thread="m3" />
      </>,
    ),
  )
  expect(message).toContain('hole "H1"')
  expect(message).toContain("pick one")
})

test("a screw and an insert on one hole are refused", async () => {
  const message = await renderFailure(
    mount(
      <>
        <assembly.screw thread="m3" />
        <enclosure.fdm.heatsetinsert thread="m3" />
      </>,
    ),
  )
  expect(message).toContain('hole "H1"')
  expect(message).toContain("pick one")
})

test("a bolt and insert of different threads are refused", async () => {
  const message = await renderFailure(
    mount(
      <>
        <assembly.bolt thread="m3" />
        <enclosure.fdm.heatsetinsert thread="m4" />
      </>,
    ),
  )
  expect(message).toContain('hole "H1"')
  expect(message).toContain("same thread")
})

test("two screws on one hole are refused rather than one overwriting the other", async () => {
  const message = await renderFailure(
    mount(
      <>
        <assembly.screw thread="m3" />
        <assembly.screw thread="m3" />
      </>,
    ),
  )
  expect(message).toContain('hole "H1"')
  expect(message).toContain("more than one screw")
})

test("an enclosure does not adopt another board's hardware", async () => {
  const { circuit } = getTestFixture()
  circuit.add(
    <assembly.device name="DEV1">
      <board name="B1" width="40mm" height="24mm">
        <hole name="H1" pcbX={-8} pcbY={0} diameter="3.4mm">
          <assembly.screw thread="m3" />
        </hole>
      </board>
      <board name="B2" width="30mm" height="20mm" pcbY={60}>
        <hole name="H9" pcbX={0} pcbY={0} diameter="3.4mm">
          <assembly.screw thread="m4" />
        </hole>
      </board>
      <enclosure.fdm.box name="EN1" boardRef=".B1" standoffHeight={8} />
    </assembly.device>,
  )
  await circuit.renderUntilSettled()

  const circuitJson = await circuit.getCircuitJson()
  const hardware = (circuitJson as any[]).filter(
    (e) => e.type === "cad_component" && e.footprinter_string,
  )
  // Only B1's M3 screw. B2's M4 belongs to no enclosure, so it is not built.
  expect(hardware.map((h) => h.footprinter_string)).toEqual([
    "screw_m3_l8mm_socketcap",
  ])
})

test("the authored head reaches the emitted part", async () => {
  const headOf = async (head?: string) => {
    const { circuit } = getTestFixture()
    circuit.add(
      (
        <assembly.device name="DEV1">
          <board name="B1" width="40mm" height="24mm">
            <hole name="H1" pcbX={-8} pcbY={0} diameter="3.4mm">
              <assembly.screw thread="m3" {...(head ? { head } : {})} />
            </hole>
          </board>
          <enclosure.fdm.box name="EN1" boardRef=".B1" standoffHeight={8} />
        </assembly.device>
      ) as never,
    )
    await circuit.renderUntilSettled()
    const circuitJson = await circuit.getCircuitJson()
    return (circuitJson as any[]).find(
      (e) => e.type === "cad_component" && e.footprinter_string,
    )?.footprinter_string
  }

  expect(await headOf("panhead")).toContain("pan")
  expect(await headOf("buttonhead")).toContain("button")
  expect(await headOf("socketcap")).toContain("socketcap")
  expect(await headOf()).toContain("socketcap")
})

/**
 * A countersunk board-mount head would bear on the PCB, which the enclosure
 * does not machine.
 */
test("a countersunk head on a board mount is refused, and says why", async () => {
  const message = await renderFailure(
    mount(<assembly.screw thread="m3" head="countersunk" />),
  )
  expect(message).toContain("countersunk")
  expect(message).toContain("bears on the PCB")
  // Suggested heads must be accepted by the solver, not just the props schema.
  for (const suggested of message.match(/head="([a-z_]+)"/g) ?? []) {
    const head = suggested.slice('head="'.length, -1)
    expect(() =>
      createFdmEnclosure({
        board: { width: 40, height: 24, thickness: 1.6 },
        standoffHeight: 8,
        mounts: [
          {
            id: "EN1.H1",
            fastens: "board",
            anchor: { x: -8, y: 0 },
            thread: "m3",
            fastening: "self_tapping",
            head,
          },
        ],
      }),
    ).not.toThrow()
  }
})
