import { expect, test } from "bun:test"
import { assembly, enclosure } from "lib"
import { getTestFixture } from "tests/fixtures/get-test-fixture"

/**
 * Same-named holes in different groups use different fastening methods,
 * so merging their identities changes the emitted hardware.
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

  expect(families).toEqual(["bolt", "heatsetinsert", "screw"])
})
