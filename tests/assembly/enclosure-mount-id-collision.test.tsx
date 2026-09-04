import { expect, test } from "bun:test"
import { assembly, enclosure } from "lib"
import { getTestFixture } from "tests/fixtures/get-test-fixture"

/**
 * Two holes that share a name are still two mounts.
 *
 * A hole's `name` is scoped to the group holding it, so one board can carry two
 * holes both called "H1". The mount id was that name, and it keys the lookup
 * that decides whether a piece is drawn as a `screw_` (thread-forming, into
 * plastic) or a `bolt_` (into a brass insert). With a duplicate id the second
 * mount overwrote the first, and the bolt came out as a thread-forming screw --
 * a screw shown threading into an insert, which is the exact contradiction the
 * "a mount is joined, not read off one element" rule exists to make unspellable.
 *
 * The fixture puts the two fastening methods on the two same-named holes,
 * because that is the only arrangement where the collision changes the answer:
 * two screws, or two bolts, agree whichever mount won.
 */
test("two holes with the same name are two mounts, each with its own fastening", async () => {
  const { circuit } = getTestFixture()

  circuit.add(
    <assembly.device name="DEV1">
      <board name="B1" width="40mm" height="24mm" routingDisabled>
        <group name="G1">
          <hole name="H1" pcbX={-14} pcbY={0} diameter="3.4mm">
            <enclosure.fdm.heatsetinsert thread="m3" />
            <assembly.bolt thread="m3" />
          </hole>
        </group>
        <group name="G2">
          <hole name="H1" pcbX={14} pcbY={0} diameter="3.4mm">
            <assembly.screw thread="m3" />
          </hole>
        </group>
      </board>
      <enclosure.fdm.box name="EN1" boardRef=".B1" standoffHeight={8} />
    </assembly.device>,
  )

  await circuit.renderUntilSettled()

  const families = circuit
    .getCircuitJson()
    .filter((e) => e.type === "cad_component")
    .map((e) => (e as { footprinter_string?: string }).footprinter_string)
    .filter((s): s is string => Boolean(s))
    .filter((s) => /^(bolt|screw|heatsetinsert)_/.test(s))
    .map((s) => s.split("_")[0])
    .sort()

  // The insert mount contributes an insert and a bolt; the screw mount
  // contributes a screw. A collision loses one of the two mounts' methods and
  // yields two screws, or a bolt where a screw was authored.
  expect(families).toEqual(["bolt", "heatsetinsert", "screw"])
})
