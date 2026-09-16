import type { HardwareOccurrence } from "@tscircuit/create-fdm-enclosure"
import { Euler, MathUtils, Matrix4, Vector3 } from "three"
import type { EnclosureFdmBox } from "./EnclosureFdmBox"

/**
 * Each hardware piece needs its own source and synthetic PCB owner for CAD;
 * a bolt and insert sharing a hole remain separate parts.
 */

export const emitEnclosureHardwareCadComponents = ({
  component,
  hardware,
  enclosureOrigin,
}: {
  component: EnclosureFdmBox
  hardware: HardwareOccurrence[]
  /** Enclosure-origin POINT in right-handed Circuit JSON Z-up world, mm. */
  enclosureOrigin: { x: number; y: number; z: number }
}): void => {
  const root = component.root
  if (!root || root.pcbDisabled) return
  const worldFromEnclosure = new Matrix4().makeTranslation(
    enclosureOrigin.x,
    enclosureOrigin.y,
    enclosureOrigin.z,
  )

  for (const piece of hardware) {
    const worldFromPart = new Matrix4().multiplyMatrices(
      worldFromEnclosure,
      new Matrix4().fromArray(piece.enclosureFromPart),
    )
    const origin = new Vector3().setFromMatrixPosition(worldFromPart)
    const position = { x: origin.x, y: origin.y, z: origin.z }
    // Circuit JSON currently serializes intrinsic XYZ degrees. Decompose only
    // here, after the solver's complete datum-to-target placement is composed.
    const angles = new Euler().setFromRotationMatrix(worldFromPart, "XYZ")
    const rotation = {
      x: MathUtils.radToDeg(angles.x),
      y: MathUtils.radToDeg(angles.y),
      z: MathUtils.radToDeg(angles.z),
    }

    const sourceComponentId = `${component.source_component_id}_${piece.id}`
    const pcbComponentId = `${component.pcb_component_id}_${piece.id}`
    component.insertGeneratedElement({
      type: "source_component",
      source_component_id: sourceComponentId,
      ftype: "simple_chip",
      name: `${component.name}_${piece.id}`,
      supplier_part_numbers: piece.supplierPartNumbers,
      manufacturer_part_number: piece.manufacturerPartNumber,
      display_value: piece.displayValue,
    })

    // Synthetic CAD owner, excluded from placement and obstruction checks.
    component.insertGeneratedElement({
      type: "pcb_component",
      pcb_component_id: pcbComponentId,
      center: {
        x: position.x,
        y: position.y,
      },
      width: 0,
      height: 0,
      layer: "top",
      rotation: 0,
      source_component_id: sourceComponentId,
      do_not_place: true,
      is_allowed_to_be_off_board: true,
      obstructs_within_bounds: false,
    })

    // A part without a supported model is still a BOM occurrence.
    if (!piece.hardwareString) continue
    component.insertGeneratedElement({
      type: "cad_component",
      cad_component_id: `${component.source_component_id}_${piece.id}`,
      position,
      rotation,
      pcb_component_id: pcbComponentId,
      source_component_id: sourceComponentId,
      // enclosureFromPart already accounts for the model's native physical datum.
      // Renderers also resolve modelprinter strings through footprinter_string.
      footprinter_string: piece.hardwareString,
      model_origin_position: { x: 0, y: 0, z: 0 },
      anchor_alignment: "center",
      model_object_fit: "contain_within_bounds",
    })
  }
}
