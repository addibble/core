import { expect, test } from "bun:test"
import { assembly, enclosure } from "lib"
import { getTestFixture } from "tests/fixtures/get-test-fixture"

/**
 * A mount is one of exactly two shapes: a screw threading straight into the
 * boss, or a bolt into an insert set in it.
 *
 * The fastening method is carried by WHICH elements are present rather than by
 * a flag, which is only sound if every other combination is refused. Before
 * these checks each of the cases below completed quietly and wrongly: a lone
 * insert and a lone bolt both resolved to `heat_set_insert`, so the solver
 * fitted the missing half itself and the enclosure was built for hardware
 * nobody had ordered.
 *
 * Each case names the hole, because "one of your mounts is wrong" is not
 * actionable in a design with twelve of them.
 */

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
  // The second used to replace the first in the map, so the part vanished from
  // the enclosure and from the BOM with no diagnostic at all.
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

/**
 * Hardware is looked up from the whole tree, because a selector may reach it
 * from anywhere -- but a second board's holes are not this enclosure's mounts.
 *
 * Without the board check this produced a boss for B2's hole placed at
 * coordinates measured from B1's centre: hardware in the wrong place rather
 * than hardware missing, which is far harder to notice.
 */
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

/**
 * Head shape is authored, not assumed.
 *
 * It was hardcoded to socket cap, so `<assembly.screw head="panhead" />` was
 * accepted and silently ignored -- and the RFC needs head shape precisely
 * because the enclosure has to cut a recess for it, which is the one thing a
 * wrong head makes wrong.
 */
test("the authored head reaches the emitted part", async () => {
  const headOf = async (
    head?: "socketcap" | "countersunk" | "panhead" | "buttonhead",
  ) => {
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
  // Omitted defaults to socket cap: the commonest fastener in this class, and
  // the one needing only a plain counterbore.
  expect(await headOf()).toContain("socketcap")
})

/**
 * The solver refuses a countersunk head on a BOARD mount, because the cone
 * would bear on the PCB -- which the enclosure does not machine -- rather than
 * on anything it cut. Worth pinning: it is a real mechanical rule, and the kind
 * that gets "simplified" away by someone who reads it as an arbitrary limit.
 */
test("a countersunk head on a board mount is refused, and says why", async () => {
  const message = await renderFailure(
    mount(<assembly.screw thread="m3" head="countersunk" />),
  )
  expect(message).toContain("countersunk")
  expect(message).toContain("bears on the PCB")
})
