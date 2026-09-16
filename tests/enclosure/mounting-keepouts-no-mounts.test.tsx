import { expect, test } from "bun:test"
import { assembly, enclosure } from "lib"
import { getTestFixture } from "tests/fixtures/get-test-fixture"

test("enclosures without mounting hardware add no keepouts or late DRC pass", async () => {
  const { circuit } = getTestFixture()
  const phases: string[] = []
  circuit.on("asyncEffect:start", (event) => {
    if (event.effectName === "board:drc-checks") phases.push(event.phase)
  })
  circuit.add(
    <assembly.device>
      <board name="B1" width={40} height={24}>
        <hole name="H1" diameter={3.4} />
      </board>
      <enclosure.fdm.box boardRef=".B1" />
    </assembly.device>,
  )
  await circuit.renderUntilSettled()
  expect(circuit.db.pcb_keepout.list()).toHaveLength(0)
  expect(phases).not.toContain("EnclosurePcbDesignRuleChecks")
  expect(circuit.db.cad_component.list()).toHaveLength(2)
})
