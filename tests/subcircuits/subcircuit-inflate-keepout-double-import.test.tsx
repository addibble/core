import { expect, test } from "bun:test"
import {
  checkPcbComponentOverKeepout,
  checkPcbCopperOverKeepout,
} from "@tscircuit/checks"
import { getTestFixture } from "tests/fixtures/get-test-fixture"

test("double import preserves scoped keepout exclusions without adding routing boundaries", async () => {
  const { circuit: source } = getTestFixture()
  source.add(
    <board width={20} height={20}>
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
  const importedJson = source.getCircuitJson()
  const { circuit: target } = getTestFixture()
  target.add(
    <board width={60} height={30}>
      <subcircuit name="I1" pcbX={-10} pcbY={0} circuitJson={importedJson} />
      <subcircuit name="I2" pcbX={10} pcbY={0} circuitJson={importedJson} />
    </board>,
  )
  await target.renderUntilSettled()
  expect(
    target.db.source_component.list().filter((source) => source.name === "EX"),
  ).toHaveLength(4)
  const footprintErrors = checkPcbComponentOverKeepout(target.getCircuitJson())
  const copperErrors = checkPcbCopperOverKeepout(target.getCircuitJson())
  for (const name of ["I1", "I2"]) {
    const imported = target
      .firstChild!.getDescendants()
      .find((component) => component.name === name)!
    const descendants = imported.getDescendants()
    expect(descendants.some((component) => component.isSubcircuit)).toBe(false)
    const excluded = descendants.find(
      (component) => component.name === "EX" && component.parent?.name === "A",
    )!
    const checked = descendants.find(
      (component) => component.name === "EX" && component.parent?.name === "B",
    )!
    const keepout = target.db.pcb_keepout.getWhere({
      subcircuit_id: imported.getSubcircuit().subcircuit_id,
    })!
    expect(keepout.excluded_pcb_component_ids).toEqual([
      excluded.pcb_component_id!,
    ])
    expect(
      footprintErrors.some(
        (error) =>
          error.pcb_placement_error_id ===
          `component_over_keepout_${checked.pcb_component_id}_${keepout.pcb_keepout_id}`,
      ),
    ).toBe(true)
    expect(
      copperErrors.some(
        (error) =>
          error.pcb_placement_error_id ===
          `copper_over_keepout_${checked.pcb_component_id}_${keepout.pcb_keepout_id}`,
      ),
    ).toBe(true)
  }
})
