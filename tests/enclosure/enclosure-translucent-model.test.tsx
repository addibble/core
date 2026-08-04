import { expect, test } from "bun:test"
import { assembly, enclosure } from "lib"
import { getTestFixture } from "tests/fixtures/get-test-fixture"

const render = async (props: Record<string, unknown>) => {
  const { circuit } = getTestFixture()
  circuit.add(
    <assembly.device name="dev">
      <board name="B1" width="40mm" height="24mm" routingDisabled />
      <enclosure.fdm.box boardRef=".B1" {...props} />
    </assembly.device>,
  )
  await circuit.renderUntilSettled()
  return (circuit.getCircuitJson() as any[]).find(
    (e) => e.type === "cad_fdm_enclosure",
  )
}

test("an enclosure is opaque unless asked otherwise", async () => {
  const enclosureRecord = await render({})
  expect(enclosureRecord.show_as_translucent_model).toBe(false)
})

test("showAsTranslucentModel reaches the emitted record", async () => {
  const enclosureRecord = await render({ showAsTranslucentModel: true })
  expect(enclosureRecord.show_as_translucent_model).toBe(true)

  // Presentation only: the geometry a renderer or exporter consumes is the same
  // plan either way, so nothing about the printed part changes.
  const opaque = await render({})
  expect(JSON.stringify(enclosureRecord.model_jscad)).toBe(
    JSON.stringify(opaque.model_jscad),
  )
})
