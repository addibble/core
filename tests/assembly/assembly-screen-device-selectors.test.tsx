import { expect, test } from "bun:test"
import { assembly } from "lib"
import { getTestFixture } from "tests/fixtures/get-test-fixture"

test("device selectors include screens and preserve nested device scoping", async () => {
  const { circuit } = getTestFixture()
  circuit.add(
    <assembly.device name="ROOT">
      <assembly.device name="CONTROLLER">
        <board name="B1" width={20} height={12} routingDisabled>
          <connector name="J1" footprint="pinrow2" />
        </board>
      </assembly.device>
      <assembly.screen
        name="SCREEN"
        connectsTo=".B1 .J1"
        width={30}
        height={20}
      >
        <assembly.device name="DISPLAY_DRIVER" />
      </assembly.screen>
      <assembly.cable name="CABLE" length={20} connectsTo=".B1 .J1" />
    </assembly.device>,
  )
  await circuit.renderUntilSettled()
  const screen = circuit.selectOne("assemblyscreen.SCREEN")
  expect(screen).not.toBeNull()
  expect(circuit.selectOne(".SCREEN")).toBe(screen)
  expect(
    circuit
      .selectAll("assemblydevice")
      .map((device) => device.name)
      .sort(),
  ).toEqual(["CONTROLLER", "DISPLAY_DRIVER", "SCREEN"])
  expect(circuit.selectOne("assemblydevice.SCREEN")).toBe(screen)
  expect(
    circuit.selectOne("assemblydevice > assemblydevice.DISPLAY_DRIVER")?.name,
  ).toBe("DISPLAY_DRIVER")
  expect(
    circuit.selectAll("assemblyscreen").map((device) => device.name),
  ).toEqual(["SCREEN"])
})
