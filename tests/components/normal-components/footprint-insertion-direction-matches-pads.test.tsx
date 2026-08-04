import { expect, test } from "bun:test"
import { getTestFixture } from "tests/fixtures/get-test-fixture"

/**
 * `insertion_direction` must name the board edge the footprint's insertion side
 * actually points at. Rather than restate the transform, this derives the
 * expected answer from the pads: pin1 is placed on the footprint's local +Y,
 * which is what `from_top` means, so wherever pin1 lands relative to the
 * component is the direction the part is reached from.
 */
const directionFromPin1Offset = (dx: number, dy: number) => {
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? "from_right" : "from_left"
  return dy >= 0 ? "from_top" : "from_bottom"
}

test("insertion_direction agrees with pad geometry on both layers", () => {
  const { circuit } = getTestFixture()

  const placements = [
    { name: "TOP0", layer: "top", rotation: 0 },
    { name: "TOP90", layer: "top", rotation: 90 },
    { name: "TOP180", layer: "top", rotation: 180 },
    { name: "TOP270", layer: "top", rotation: 270 },
    { name: "BOT0", layer: "bottom", rotation: 0 },
    { name: "BOT90", layer: "bottom", rotation: 90 },
    { name: "BOT180", layer: "bottom", rotation: 180 },
    { name: "BOT270", layer: "bottom", rotation: 270 },
  ] as const

  circuit.add(
    <board width="120mm" height="40mm">
      {placements.map((placement, index) => (
        <chip
          key={placement.name}
          name={placement.name}
          layer={placement.layer}
          pcbX={-52 + index * 15}
          pcbY={0}
          pcbRotation={placement.rotation}
          footprint={
            <footprint insertionDirection="from_top">
              <smtpad
                shape="rect"
                portHints={["pin1"]}
                pcbX={0}
                pcbY={4}
                width={1}
                height={1}
              />
              <smtpad
                shape="rect"
                portHints={["pin2"]}
                pcbX={0}
                pcbY={-4}
                width={1}
                height={1}
              />
              <smtpad
                shape="rect"
                portHints={["pin3"]}
                pcbX={2}
                pcbY={-4}
                width={1}
                height={1}
              />
            </footprint>
          }
        />
      ))}
    </board>,
  )

  circuit.render()

  for (const placement of placements) {
    const sourceComponent = circuit.db.source_component
      .list()
      .find((component) => component.name === placement.name)!
    const pcbComponent = circuit.db.pcb_component
      .list()
      .find(
        (component) =>
          component.source_component_id === sourceComponent.source_component_id,
      )!
    const pin1 = circuit.db.pcb_smtpad
      .list()
      .find(
        (pad) =>
          pad.pcb_component_id === pcbComponent.pcb_component_id &&
          pad.port_hints?.includes("pin1"),
      )!
    if (!("x" in pin1)) throw new Error("expected a positioned pad")

    expect(pcbComponent.insertion_direction).toBe(
      directionFromPin1Offset(
        pin1.x - pcbComponent.center.x,
        pin1.y - pcbComponent.center.y,
      ),
    )
  }
})
