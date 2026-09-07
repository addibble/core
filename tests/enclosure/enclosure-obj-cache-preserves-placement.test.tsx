import { expect, spyOn, test } from "bun:test"
import type { CreateFdmEnclosureInput } from "@tscircuit/create-fdm-enclosure"
import { enclosure } from "lib"
import { getTestFixture } from "tests/fixtures/get-test-fixture"
import { getTestStaticAssetsServer } from "tests/fixtures/get-test-static-assets-server"

test("one parsed OBJ is shared without caching either occurrence's placement", async () => {
  const assets = getTestStaticAssetsServer()
  const objUrl = `${assets.url}/models/enclosure-review-y-normal-body.obj`
  const fetchSpy = spyOn(globalThis, "fetch")
  try {
    const { circuit } = getTestFixture()
    let input: CreateFdmEnclosureInput | undefined
    circuit.on("solver:started", (event) => {
      if (event.solverName === "CreateFdmEnclosureSolver")
        input = event.solverParams
    })
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
          {(["top", "bottom"] as const).map((layer) => (
            <chip
              key={layer}
              name={layer === "top" ? "U1" : "U2"}
              layer={layer}
              pcbX={0}
              pcbY={0}
              pcbRotation={layer === "top" ? 90 : 0}
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
              cadModel={{
                objUrl,
                modelBoardNormalDirection: "y+",
                modelOriginPosition: { x: 0, y: 0, z: 0 },
                positionOffset: { x: layer === "top" ? 12 : -12, y: 4, z: 0 },
              }}
            />
          ))}
        </board>
      </group>,
    )
    await circuit.renderUntilSettled()
    const components = input!.components!
    const top = components.find((c) => c.id.includes("U1"))!
    const bottom = components.find((c) => c.id.includes("U2"))!
    expect(top.solid?.type).toBe("jscad")
    expect(bottom.solid?.type).toBe("jscad")
    expect(top.center.x).toBeCloseTo(12, 5)
    expect(bottom.center.x).toBeCloseTo(-12, 5)
    expect(top.body.size?.x).toBeCloseTo(20, 5)
    expect(top.body.size?.y).toBeCloseTo(6, 5)
    expect(bottom.body.size?.x).toBeCloseTo(6, 5)
    expect(bottom.body.size?.y).toBeCloseTo(20, 5)
    expect(top.body.aboveBoardHeight).toBeCloseTo(4, 5)
    expect(bottom.body.aboveBoardHeight).toBeCloseTo(4, 5)
    expect(fetchSpy.mock.calls.filter(([url]) => url === objUrl)).toHaveLength(
      1,
    )
  } finally {
    fetchSpy.mockRestore()
  }
})
