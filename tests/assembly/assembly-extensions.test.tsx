import { expect, test } from "bun:test"
import {
  AssemblyBolt,
  AssemblyCable,
  AssemblyScreen,
  AssemblyScrew,
  EnclosureFdmHeatsetInsert,
} from "lib/components"
import { assembly, enclosure } from "lib"
import type { PrimitiveComponent } from "lib/components/base-components/PrimitiveComponent"
import { getTestFixture } from "tests/fixtures/get-test-fixture"

/**
 * These elements are found by class rather than by selector, the way
 * `EnclosureFdmBox_doInitialCadModelRender` already finds screw bosses.
 */
const descendantsOfType = <T extends PrimitiveComponent>(
  circuit: any,
  ctor: new (...args: any[]) => T,
): T[] =>
  (circuit.firstChild?.getDescendants() ?? []).filter(
    (d: PrimitiveComponent): d is T => d instanceof ctor,
  )

test("assembly extensions render in both accepted spellings", async () => {
  const { circuit } = getTestFixture()

  circuit.add(
    <assembly.device name="D1">
      <board name="B1" width="40mm" height="24mm" routingDisabled>
        {/* nested spelling: the insert is a child of its hole */}
        <hole name="H1" pcbX={-15} pcbY={-8} diameter="3.2mm">
          <enclosure.fdm.heatsetinsert thread="m3" />
        </hole>
        {/* selector spelling: the hole is plain, the insert points at it */}
        <hole name="H2" pcbX={15} pcbY={-8} diameter="3.2mm" />
      </board>

      <enclosure.fdm.heatsetinsert thread="m3" holeRef=".B1 .H2" />
      <assembly.bolt thread="m3" length="14mm" holeRef=".B1 .H1" fastensLid />
      <enclosure.fdm.box name="EN1" boardRef=".B1" />
    </assembly.device>,
  )

  await circuit.renderUntilSettled()

  const inserts = descendantsOfType(circuit, EnclosureFdmHeatsetInsert)
  expect(inserts).toHaveLength(2)
  // threads are lowercase in the authoring layer
  expect(inserts.map((i) => i._parsedProps.thread).sort()).toEqual(["m3", "m3"])
  // the nested one needs no selector; the free-standing one carries it
  expect(inserts.map((i) => i.getHoleSelector()).sort()).toEqual([
    ".B1 .H2",
    null,
  ])

  const bolts = descendantsOfType(circuit, AssemblyBolt)
  expect(bolts).toHaveLength(1)
  expect(bolts[0]!.getHoleSelector()).toBe(".B1 .H1")
  expect(bolts[0]!.getFastensLid()).toBe(true)
  expect(bolts[0]!._parsedProps.length).toBe(14)
})

test("a screw carries the thread and a procurement designation", async () => {
  const { circuit } = getTestFixture()

  circuit.add(
    <assembly.device name="D1">
      <board name="B1" width="40mm" height="24mm" routingDisabled>
        <hole name="H2" pcbX={15} pcbY={-8} diameter="3.2mm">
          <assembly.screw
            thread="m3"
            designation="phillips pan-head plastite thread-forming screw for thermoplastic"
          />
        </hole>
      </board>
      {/* a self-tapping M3 needs a deeper boss than the 4mm default standoff */}
      <enclosure.fdm.box name="EN1" boardRef=".B1" standoffHeight="6mm" />
    </assembly.device>,
  )
  await circuit.renderUntilSettled()

  const [screw] = descendantsOfType(circuit, AssemblyScrew)
  expect(screw!._parsedProps.thread).toBe("m3")
  expect(screw!.getDesignation()).toMatch(/plastite/)
  // no length prop exists: the stack decides it
  expect("length" in (screw!._parsedProps as object)).toBe(false)
})

test("a screen is a device, and a cable records its endpoints", async () => {
  const { circuit } = getTestFixture()

  circuit.add(
    <assembly.device name="D1">
      <board name="B1" width="40mm" height="24mm" routingDisabled>
        <connector name="J1" footprint="pinrow4" pcbX={0} pcbY={-10} />
      </board>

      <assembly.screen
        name="SCREEN"
        connectsTo=".B1 .J1"
        width="2.3in"
        height="1.8in"
      />
      <assembly.cable connectsTo=".B1 .J1" length="200mm" color="black" />
    </assembly.device>,
  )

  await circuit.renderUntilSettled()

  const [screen] = descendantsOfType(circuit, AssemblyScreen)
  expect(screen).toBeDefined()
  expect(screen!.getConnectorSelector()).toBe(".B1 .J1")
  // a screen is a kind of device, structurally, not by convention
  expect(screen!.isAssemblyDeviceContainer).toBe(true)

  const [cable] = descendantsOfType(circuit, AssemblyCable)
  expect(cable!.getEndpointSelectors()).toEqual([".B1 .J1"])
})

test("a cable joins at most two endpoints", async () => {
  const { circuit } = getTestFixture()

  circuit.add(
    <assembly.device name="D1">
      <board name="B1" width="20mm" height="20mm" routingDisabled />
      <assembly.cable connectsTo={[".B1 .J1", ".B2 .J4"]} length="200mm" />
    </assembly.device>,
  )

  await circuit.renderUntilSettled()

  const [cable] = descendantsOfType(circuit, AssemblyCable)
  expect(cable!.getEndpointSelectors()).toEqual([".B1 .J1", ".B2 .J4"])
})

test("a mount is joined from the hole, the insert and the bolt", async () => {
  const { circuit } = getTestFixture()

  circuit.add(
    <assembly.device name="D1">
      <board name="B1" width="40mm" height="24mm" routingDisabled>
        <hole name="H1" pcbX={-15} pcbY={-8} diameter="3.2mm">
          <enclosure.fdm.heatsetinsert thread="m3" />
        </hole>
        {/* a plain hole with no hardware is not a mount */}
        <hole name="H9" pcbX={0} pcbY={0} diameter="3.2mm" />
      </board>
      <assembly.bolt thread="m3" length="14mm" holeRef=".B1 .H1" fastensLid />
      <enclosure.fdm.box name="EN1" boardRef=".B1" />
    </assembly.device>,
  )
  await circuit.renderUntilSettled()

  const cad = circuit.db.cad_component.list().filter((c: any) => c.model_jscad)
  // the enclosure solved and produced printed parts
  expect(cad.length).toBeGreaterThan(0)
})

test("a screw and a heat-set insert on one hole is an error", async () => {
  const { circuit } = getTestFixture()

  circuit.add(
    <assembly.device name="D1">
      <board name="B1" width="40mm" height="24mm" routingDisabled>
        <hole name="H1" pcbX={-15} pcbY={-8} diameter="3.2mm">
          <assembly.screw thread="m3" />
          <enclosure.fdm.heatsetinsert thread="m3" />
        </hole>
      </board>
      <enclosure.fdm.box name="EN1" boardRef=".B1" />
    </assembly.device>,
  )

  await expect(circuit.renderUntilSettled()).rejects.toThrow(/pick one/)
})

test("a bolt with no length is derived from the stack", async () => {
  const { circuit } = getTestFixture()

  circuit.add(
    <assembly.device name="D1">
      <board name="B1" width="40mm" height="24mm" routingDisabled>
        <hole name="H1" pcbX={-15} pcbY={-8} diameter="3.2mm">
          <enclosure.fdm.heatsetinsert thread="m3" />
        </hole>
      </board>
      <assembly.bolt thread="m3" holeRef=".B1 .H1" fastensLid />
      <enclosure.fdm.box name="EN1" boardRef=".B1" />
    </assembly.device>,
  )

  await circuit.renderUntilSettled()
  expect(circuit.db.cad_component.list().length).toBeGreaterThan(0)
})
