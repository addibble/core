import { expect, test } from "bun:test"
import type { CreateFdmEnclosureInput } from "@tscircuit/create-fdm-enclosure"
import { enclosure } from "lib"
import { getTestFixture } from "tests/fixtures/get-test-fixture"

test("child CAD bounds share object-model placement off origin and preserve the bottom-layer Y flip", () => {
  for (const layer of ["top", "bottom"] as const) {
    for (const rotation of [0, 90, 180, 270]) {
      const { circuit } = getTestFixture()
      let input: CreateFdmEnclosureInput | undefined
      circuit.on("solver:started", (event) => {
        if (event.solverName === "CreateFdmEnclosureSolver")
          input = event.solverParams
      })
      const model = {
        modelOriginPosition: { x: 0, y: 0, z: 0 },
        modelBoardNormalDirection: "y+" as const,
        modelBounds: {
          min: { x: 1, y: 0, z: -10 },
          max: { x: 7, y: 4, z: 10 },
        },
        positionOffset: { x: 12, y: 4, z: 0 },
      }
      circuit.add(
        <group>
          <enclosure.fdm.box name="EN1" boardRef=".B1" />
          <board
            name="B1"
            pcbX={100}
            pcbY={50}
            width={80}
            height={80}
            thickness={1.6}
            routingDisabled
          >
            <chip
              name="CHILD"
              pcbX={0}
              pcbY={0}
              layer={layer}
              pcbRotation={rotation}
              footprint={
                <footprint>
                  <smtpad
                    portHints={["1"]}
                    shape="rect"
                    width={0.5}
                    height={0.5}
                  />
                </footprint>
              }
              cadModel={
                <cadmodel modelUrl="https://example.com/body.step" {...model} />
              }
            />
            <chip
              name="OBJECT"
              pcbX={0}
              pcbY={0}
              layer={layer}
              pcbRotation={rotation}
              footprint={
                <footprint>
                  <smtpad
                    portHints={["1"]}
                    shape="rect"
                    width={0.5}
                    height={0.5}
                  />
                </footprint>
              }
              cadModel={{ stepUrl: "https://example.com/body.step", ...model }}
            />
          </board>
        </group>,
      )
      circuit.render()
      const child = input!.components!.find((c) => c.id.includes("CHILD"))!
      const object = input!.components!.find((c) => c.id.includes("OBJECT"))!
      expect(child.center.x).toBeCloseTo(object.center.x, 5)
      expect(child.center.y).toBeCloseTo(object.center.y, 5)
      expect(child.body.size?.x).toBeCloseTo(rotation % 180 === 0 ? 6 : 20, 5)
      expect(child.body.size?.y).toBeCloseTo(rotation % 180 === 0 ? 20 : 6, 5)
      expect(child.body.aboveBoardHeight).toBeCloseTo(4, 5)
      // Native +X is reflected by a proper Y half-turn on the bottom layer.
      const centers =
        layer === "bottom"
          ? [
              [8, 4],
              [12, 0],
              [16, 4],
              [12, 8],
            ]
          : [
              [16, 4],
              [12, 8],
              [8, 4],
              [12, 0],
            ]
      expect(child.center.x).toBeCloseTo(centers[rotation / 90]![0]!, 5)
      expect(child.center.y).toBeCloseTo(centers[rotation / 90]![1]!, 5)
    }
  }
})
