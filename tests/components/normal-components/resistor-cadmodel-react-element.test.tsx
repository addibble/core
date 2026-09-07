import { expect, it } from "bun:test"
import { convertCircuitJsonToGltf } from "circuit-json-to-gltf"
import { Box3 } from "three"
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js"
import { getTestFixture } from "tests/fixtures/get-test-fixture"
import "lib/register-catalogue"

it("resistor with cadmodel react element", async () => {
  const { circuit, staticAssetsServerUrl } = getTestFixture({
    withStaticAssetsServer: true,
  })

  circuit.add(
    <board width="10mm" height="10mm">
      <resistor
        name="R1_cadModel_offset"
        resistance={1000}
        footprint="0402"
        cadModel={
          <cadmodel
            modelUrl={`${staticAssetsServerUrl}/models/C2889342.obj`}
            pcbX={1}
          />
        }
      />
    </board>,
  )

  circuit.render()

  const cadComponents = circuit.db.cad_component.list()
  expect(cadComponents).toHaveLength(1)
  expect(cadComponents[0].model_obj_url).toBe(
    `${staticAssetsServerUrl}/models/C2889342.obj`,
  )
  expect(cadComponents[0].position.x).toBeCloseTo(1)

  const glb = await convertCircuitJsonToGltf(cadComponents, {
    format: "glb",
    includeModels: true,
  })
  const buffer =
    glb instanceof ArrayBuffer
      ? glb
      : glb instanceof Uint8Array
        ? new Uint8Array(glb).buffer
        : undefined
  if (!buffer) throw new Error("Expected a binary GLB")
  const model = await new GLTFLoader().parseAsync(buffer, "")
  const bounds = new Box3().setFromObject(model.scene)
  // This asset spans native Z=-0.25..0.25. Its contact face, not its native
  // origin, must sit on the board; the old export buried half of the resistor.
  expect(bounds.min.y).toBeCloseTo(cadComponents[0].position.z, 5)
  expect(bounds.max.y - bounds.min.y).toBeCloseTo(0.5, 5)

  await expect(circuit).toMatchSimple3dSnapshot(import.meta.path)
})
