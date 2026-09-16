import { expect, test } from "bun:test"
import { getTestFixture } from "tests/fixtures/get-test-fixture"

test("inflated footprint keepouts retain layers and explicit exclusions while remapping their owner", async () => {
  const { circuit: source } = getTestFixture()
  source.add(
    <board width={40} height={30}>
      <chip
        name="OWNER"
        layer="bottom"
        footprint={
          <footprint>
            <smtpad shape="rect" width={1} height={1} portHints={["1"]} />
            <keepout
              shape="rect"
              width={4}
              height={4}
              layers={["top"]}
              excludeRefs={[".OWNER", ".EXEMPT"]}
            />
          </footprint>
        }
      />
      <chip name="EXEMPT" pcbX={8} footprint="0402" />
      <keepout shape="circle" radius={1} pcbX={-12} layers={["bottom"]} />
    </board>,
  )
  await source.renderUntilSettled()
  const originalKeepout = source.db.pcb_keepout
    .list()
    .find((keepout) => keepout.shape === "rect")!
  const { circuit: target } = getTestFixture()
  target.add(
    <board width={50} height={40}>
      <resistor name="PREFIX" resistance="1k" footprint="0402" pcbX={20} />
      <subcircuit name="Imported" circuitJson={source.getCircuitJson()} />
    </board>,
  )
  await target.renderUntilSettled()
  const owner = target.db.source_component.getWhere({ name: "OWNER" })!
  const other = target.db.source_component.getWhere({ name: "EXEMPT" })!
  const ownerPcb = target.db.pcb_component.getWhere({
    source_component_id: owner.source_component_id,
  })!
  const otherPcb = target.db.pcb_component.getWhere({
    source_component_id: other.source_component_id,
  })!
  const keepouts = target.db.pcb_keepout.list()
  expect(keepouts).toHaveLength(2)
  const keepout = keepouts.find((keepout) => keepout.shape === "rect")!
  expect(keepout.pcb_component_id).toBe(ownerPcb.pcb_component_id)
  expect(keepout.pcb_component_id).not.toBe(originalKeepout.pcb_component_id)
  expect(keepout.layers).toEqual(["bottom"])
  expect(keepout.excluded_pcb_component_ids?.sort()).toEqual(
    [ownerPcb.pcb_component_id, otherPcb.pcb_component_id].sort(),
  )
  const standalone = keepouts.find((keepout) => keepout.shape === "circle")!
  expect(standalone.pcb_component_id).toBeUndefined()
  expect(standalone.layers).toEqual(["bottom"])
})
