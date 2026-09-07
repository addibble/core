import { expect, spyOn, test } from "bun:test"
import { assembly, enclosure } from "lib"
import { getTestFixture } from "tests/fixtures/get-test-fixture"

test("an unknown body emits one warning without suppressing CAD, even when the enclosure is declared first", async () => {
  const { circuit } = getTestFixture()
  circuit.add(
    <assembly.device>
      <enclosure.fdm.box name="EN1" boardRef=".B1" standoffHeight={8} />
      <board name="B1" width={40} height={24} thickness={1.6} routingDisabled>
        <chip
          name="U1"
          layer="bottom"
          cadModel={{ stepUrl: "https://example.com/unknown.step" }}
          footprint={
            <footprint>
              <smtpad portHints={["1"]} shape="rect" width={0.5} height={0.5} />
            </footprint>
          }
        />
        <hole name="H1" diameter={3.4}>
          <assembly.screw thread="m3" />
        </hole>
      </board>
    </assembly.device>,
  )
  const warn = spyOn(console, "warn").mockImplementation(() => {})
  try {
    await circuit.renderUntilSettled()
    const warnings = warn.mock.calls.filter(
      ([message]) =>
        typeof message === "string" &&
        message.includes("EN1: [component_bounds_unknown]") &&
        message.includes("U1"),
    )
    expect(warnings).toHaveLength(1)
    const enclosureSource = circuit.db.source_component.getWhere({
      name: "EN1",
    })!
    expect(
      circuit.db.cad_component
        .list()
        .filter(
          (cad) =>
            cad.source_component_id === enclosureSource.source_component_id,
        ),
    ).toHaveLength(2)
    expect(circuit.db.pcb_placement_error.list()).toHaveLength(0)
    expect(circuit.db.source_property_ignored_warning.list()).toHaveLength(0)
  } finally {
    warn.mockRestore()
  }
})
