import {
  applyMat4ToPoint3,
  composeMat4,
  mat4,
} from "@tscircuit/circuit-json-util"
import type {
  CreateFdmEnclosureInput,
  HardwareOccurrence,
} from "@tscircuit/create-fdm-enclosure"
import { Euler, MathUtils, Matrix4 } from "three"
import type { EnclosureFdmBox } from "./EnclosureFdmBox"

/**
 * The pieces of hardware a solved enclosure consumes, as Circuit JSON.
 *
 * Each piece -- a screw, a bolt, a heat-set insert, a spacer -- gets its own
 * `source_component`, `pcb_component` and `cad_component`, which is what the
 * mounting-hardware RFC settles on. A `cad_component` requires both a
 * `source_component_id` and a `pcb_component_id`, and assembly hardware has no
 * board component of its own, so the piece carries both: it is a real part with
 * a designation, so the source component is one it already deserves for the
 * BOM.
 *
 * The hole cannot carry them instead. `pcb_component.source_component_id` is
 * required, so a hole would become a BOM line -- and one hole routinely holds
 * two pieces (a bolt and the insert it threads into), which a single id on the
 * hole could not distinguish.
 *
 * This is deliberately interim. The durable record is `assembly_component`,
 * which the solver's own types already anticipate; when it exists this file
 * changes shape and nothing else does.
 */

export const emitEnclosureHardwareCadComponents = ({
  component,
  hardware,
  mounts,
  enclosureOrigin,
}: {
  component: EnclosureFdmBox
  hardware: HardwareOccurrence[]
  mounts: CreateFdmEnclosureInput["mounts"]
  /** Enclosure-origin POINT in right-handed Circuit JSON Z-up world, mm. */
  enclosureOrigin: { x: number; y: number; z: number }
}): void => {
  const root = component.root
  if (!root || root.pcbDisabled) return
  const { db } = root
  const worldFromEnclosure = mat4.fromTranslation(new Float64Array(16), [
    enclosureOrigin.x,
    enclosureOrigin.y,
    enclosureOrigin.z,
  ])

  // The solver emits modelprinter's own vocabulary, so there is nothing to
  // translate. There used to be: it spelled a bolt `screw_` and an insert
  // `insert_..._heatset`, and this file rebuilt the family from the mount's
  // fastening method, looked up by mount id. That lookup is what made a
  // duplicate mount id draw a bolt as a thread-forming screw, and the
  // `insert_` spelling matched no modelprinter family at all.
  for (const piece of hardware) {
    const modelprinterString = piece.hardwareString
    if (!modelprinterString) continue
    const worldFromPart = composeMat4(
      worldFromEnclosure,
      piece.enclosureFromPart,
    )
    const position = applyMat4ToPoint3(worldFromPart, { x: 0, y: 0, z: 0 })
    // Circuit JSON currently serializes intrinsic XYZ degrees. Decompose only
    // here, after the solver's complete datum-to-target placement is composed.
    const angles = new Euler().setFromRotationMatrix(
      new Matrix4().fromArray(worldFromPart),
      "XYZ",
    )
    const rotation = {
      x: MathUtils.radToDeg(angles.x),
      y: MathUtils.radToDeg(angles.y),
      z: MathUtils.radToDeg(angles.z),
    }

    const sourceComponent = db.source_component.insert({
      ftype: "simple_chip",
      name: `${component.name}_${piece.id}`,
      supplier_part_numbers: piece.supplierPartNumbers,
      manufacturer_part_number: piece.manufacturerPartNumber,
      display_value: piece.displayValue,
    } as never)

    // Zero-size and suppressed: it exists to give the piece a frame, not to
    // take part in placement or DRC. The same shape enclosure.fdm.box uses.
    const pcbComponent = db.pcb_component.insert({
      center: {
        x: position.x,
        y: position.y,
      },
      width: 0,
      height: 0,
      layer: "top",
      rotation: 0,
      source_component_id: sourceComponent.source_component_id,
      do_not_place: true,
      is_allowed_to_be_off_board: true,
      obstructs_within_bounds: false,
    } as never)

    db.cad_component.insert({
      position,
      rotation,
      pcb_component_id: pcbComponent.pcb_component_id,
      source_component_id: sourceComponent.source_component_id,
      // The specification travels, not a solid: ~20 bytes rather than a plan of
      // ~250 or a mesh of kilobytes, and a renderer that knows the vocabulary
      // builds it. jscad-assembly-hardware builds every model in the same
      // native frame the solver placed it in. Its selected physical datum is
      // already accounted for in enclosureFromPart, not reconstructed here.
      //
      // Carried in `footprinter_string`, which is the one field Circuit JSON
      // has for "a model named by a string". The name is historical: the
      // renderers' shared entry point (`getJscadModelForFootprint`) tries the
      // modelprinter vocabulary first and falls through to footprinter, which
      // is how `flexscreen` already travels. A second field would have split
      // one concept across two.
      footprinter_string: modelprinterString,
    } as never)
  }
}
