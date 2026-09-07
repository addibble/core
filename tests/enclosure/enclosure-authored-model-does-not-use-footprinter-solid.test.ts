import { expect, test } from "bun:test"
import type { CadComponent } from "circuit-json"
import { getEnclosureCadModelBody } from "../../lib/components/primitive-components/get-enclosure-cad-model-body"

test("an unloaded authored asset does not become an exact generic footprint solid", () => {
  const cad: CadComponent = {
    type: "cad_component",
    cad_component_id: "cad1",
    pcb_component_id: "pcb1",
    source_component_id: "source1",
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    anchor_alignment: "center",
    model_object_fit: "contain_within_bounds",
    footprinter_string: "soic8",
  }
  expect(getEnclosureCadModelBody(undefined, cad)).toBeDefined()
  for (const source of [
    { model_obj_url: "https://example.com/authored.obj" },
    { model_glb_url: "https://example.com/authored.glb" },
    { model_gltf_url: "https://example.com/authored.gltf" },
    { model_stl_url: "https://example.com/authored.stl" },
    { model_wrl_url: "https://example.com/authored.wrl" },
    { model_step_url: "https://example.com/authored.step" },
  ]) {
    expect(
      getEnclosureCadModelBody(undefined, { ...cad, ...source }),
    ).toBeUndefined()
  }
})
