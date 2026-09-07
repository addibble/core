import { expect, test } from "bun:test"
import {
  applyMat4ToPoint3,
  getCadModelPlacement,
  mat4,
  quaternionFromEulerDegrees,
} from "@tscircuit/circuit-json-util"
import { assertTransformMatrix } from "jscad-planner"
import { enclosure } from "lib"
import { EnclosureFdmBox } from "lib/components/primitive-components/EnclosureFdmBox"
import { emitEnclosureHardwareCadComponents } from "lib/components/primitive-components/EnclosureFdmBox_emitHardwareCadComponents"
import { getTestFixture } from "tests/fixtures/get-test-fixture"

test("hardware CAD serializes the solver's full rigid matrix rather than its legacy translation", () => {
  const { circuit } = getTestFixture()
  circuit.add(
    <group>
      <board name="B1" width={40} height={24} routingDisabled />
      <enclosure.fdm.box name="EN1" boardRef=".B1" />
    </group>,
  )
  circuit.render()
  const component = circuit
    .firstChild!.getDescendants()
    .find(
      (descendant): descendant is EnclosureFdmBox =>
        descendant instanceof EnclosureFdmBox,
    )!
  const enclosureFromPart = Array.from(
    mat4.fromRotationTranslation(
      new Float64Array(16),
      quaternionFromEulerDegrees({ x: 90, y: 0, z: 90 }, "xyz"),
      [3, 4, 5],
    ),
  )
  assertTransformMatrix(enclosureFromPart)
  emitEnclosureHardwareCadComponents({
    component,
    mounts: [],
    enclosureOrigin: { x: 100, y: 200, z: 300 },
    hardware: [
      {
        id: "MATRIX",
        mountId: "EN1.H1",
        role: "screw",
        hardwareString: "screw_m3_l8_socketcap",
        designation: "M3x8 socket cap",
        displayValue: "M3x8",
        bomGroupKey: "screw_m3_l8_socketcap",
        enclosureFromPart,
        position: { x: -500, y: -500, z: -500 },
      },
    ],
  })
  const source = circuit.db.source_component.getWhere({ name: "EN1_MATRIX" })!
  const cad = circuit.db.cad_component.getWhere({
    source_component_id: source.source_component_id,
  })!
  const pcb = circuit.db.pcb_component.get(cad.pcb_component_id)!
  expect(cad.position).toEqual({ x: 103, y: 204, z: 305 })
  expect(pcb.center).toEqual({ x: 103, y: 204 })
  const placed = getCadModelPlacement(cad, {
    nativeBounds: { min: { x: -1, y: -1, z: -8 }, max: { x: 1, y: 1, z: 2 } },
    nativeToCanonicalModel: mat4.create(),
  })
  const tip = applyMat4ToPoint3(placed.nativeToWorld, { x: 0, y: 0, z: -8 })
  expect(tip.x).toBeCloseTo(103, 5)
  expect(tip.y).toBeCloseTo(212, 5)
  expect(tip.z).toBeCloseTo(305, 5)
})
