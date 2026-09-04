import type { CreateFdmEnclosureInput } from "@tscircuit/create-fdm-enclosure"
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

type HardwareOccurrence = {
  id: string
  role: string
  mountId: string
  designation: string
  hardwareString: string
  displayValue: string
  manufacturerPartNumber?: string
  supplierPartNumbers?: Record<string, string[]>
  position: { x: number; y: number; z: number }
}

/**
 * Translate the solver's hardware string into a modelprinter one.
 *
 * The two vocabularies differ in exactly two places, and both differences are
 * real rather than cosmetic:
 *
 * - The solver's `role` is `screw` for anything with a head and a thread,
 *   because a screw and a bolt are the same solid. modelprinter keeps them
 *   apart, because what they thread into decides the bore the enclosure cuts --
 *   so the family is chosen from the MOUNT's fastening method, not the piece.
 * - `insert_m3_l5.7_heatset` names the method last; `heatsetinsert_m3_l5.7`
 *   names it first, because in modelprinter the family IS the method.
 *
 * Returns null for anything the vocabulary does not cover -- a press-fit insert
 * today -- so an unmodelled piece is simply not drawn rather than drawn wrong.
 */
export const toModelprinterString = (
  hardwareString: string,
  fastening: string | undefined,
): string | null => {
  const [family, ...rest] = hardwareString.split("_")

  if (family === "screw") {
    // A bolt threads into an insert; a screw forms its own thread in plastic.
    // Which one this is comes from the mount, so a missing fastening cannot be
    // defaulted -- guessing "screw" draws a thread-forming screw threading into
    // brass, and nothing downstream can tell that apart from an authored screw.
    if (fastening !== "heat_set_insert" && fastening !== "self_tapping") {
      throw new Error(
        `cannot draw "${hardwareString}": its mount has no fastening method, so there is no way to tell a screw from a bolt`,
      )
    }
    const isBolt = fastening === "heat_set_insert"
    return `${isBolt ? "bolt" : "screw"}_${rest.join("_")}`
  }

  if (family === "insert") {
    const method = rest[rest.length - 1]
    if (method !== "heatset") return null
    return `heatsetinsert_${rest.slice(0, -1).join("_")}`
  }

  if (family === "spacer") return hardwareString

  return null
}

export const emitEnclosureHardwareCadComponents = ({
  component,
  hardware,
  mounts,
  enclosureOrigin,
}: {
  component: EnclosureFdmBox
  hardware: HardwareOccurrence[]
  mounts: CreateFdmEnclosureInput["mounts"]
  /** Where the enclosure's own origin sits, in board coordinates. */
  enclosureOrigin: { x: number; y: number; z: number }
}): void => {
  const root = component.root
  if (!root || root.pcbDisabled) return
  const { db } = root

  const fasteningByMountId = new Map(
    (mounts ?? []).map((mount) => [mount.id, mount.fastening as string]),
  )

  for (const piece of hardware) {
    const modelprinterString = toModelprinterString(
      piece.hardwareString,
      fasteningByMountId.get(piece.mountId),
    )
    if (!modelprinterString) continue

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
        x: enclosureOrigin.x + piece.position.x,
        y: enclosureOrigin.y + piece.position.y,
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
      position: {
        x: enclosureOrigin.x + piece.position.x,
        y: enclosureOrigin.y + piece.position.y,
        z: enclosureOrigin.z + piece.position.z,
      },
      rotation: { x: 0, y: 0, z: 0 },
      pcb_component_id: pcbComponent.pcb_component_id,
      source_component_id: sourceComponent.source_component_id,
      // The specification travels, not a solid: ~20 bytes rather than a plan of
      // ~250 or a mesh of kilobytes, and a renderer that knows the vocabulary
      // builds it. jscad-assembly-hardware builds every model in the same
      // frame the solver placed it in -- +Z along the axis, origin at the
      // seating face -- so the position above is all the placement it needs.
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
