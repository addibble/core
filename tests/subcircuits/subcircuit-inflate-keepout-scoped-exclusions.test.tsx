import { expect, test } from "bun:test"
import {
  checkPcbComponentOverKeepout,
  checkPcbCopperOverKeepout,
} from "@tscircuit/checks"
import { getTestFixture } from "tests/fixtures/get-test-fixture"

test("reimported keepout exclusions distinguish repeated names in sibling subcircuits", async () => {
  const { circuit: source } = getTestFixture()
  source.add(
    <board width={30} height={20}>
      <subcircuit name="A" pcbX={-1} pcbY={0}>
        <chip name="EX" footprint="0402" />
      </subcircuit>
      <subcircuit name="B" pcbX={1} pcbY={0}>
        <chip name="EX" footprint="0402" />
      </subcircuit>
      <keepout shape="circle" radius={4} excludeRefs={[".A .EX"]} />
    </board>,
  )
  await source.renderUntilSettled()
  const { circuit: target } = getTestFixture()
  target.add(
    <board width={40} height={30}>
      <resistor name="PREFIX" resistance="1k" footprint="0402" pcbX={15} />
      <subcircuit name="Imported" circuitJson={source.getCircuitJson()} />
    </board>,
  )
  await target.renderUntilSettled()
  const pcbComponentIn = (groupName: string) => {
    const group = target.db.source_group.getWhere({ name: groupName })!
    const sourceComponent = target.db.source_component.getWhere({
      name: "EX",
      source_group_id: group.source_group_id,
    })!
    return target.db.pcb_component.getWhere({
      source_component_id: sourceComponent.source_component_id,
    })!
  }
  const excluded = pcbComponentIn("A")
  const checked = pcbComponentIn("B")
  const keepout = target.db.pcb_keepout.list()[0]!
  expect(keepout.excluded_pcb_component_ids).toEqual([
    excluded.pcb_component_id,
  ])
  expect(keepout.excluded_pcb_component_ids).not.toContain(
    checked.pcb_component_id,
  )
  const footprintErrors = checkPcbComponentOverKeepout(target.getCircuitJson())
  const copperErrors = checkPcbCopperOverKeepout(target.getCircuitJson())
  expect(footprintErrors.map((error) => error.pcb_placement_error_id)).toEqual([
    `component_over_keepout_${checked.pcb_component_id}_${keepout.pcb_keepout_id}`,
  ])
  expect(copperErrors.map((error) => error.pcb_placement_error_id)).toEqual([
    `copper_over_keepout_${checked.pcb_component_id}_${keepout.pcb_keepout_id}`,
  ])
  for (const expected of [...footprintErrors, ...copperErrors]) {
    expect(
      target.db.pcb_placement_error
        .list()
        .some((error) => error.message === expected.message),
    ).toBe(true)
  }
})
