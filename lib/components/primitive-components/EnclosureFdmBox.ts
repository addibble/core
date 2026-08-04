import { enclosureFdmBoxProps } from "@tscircuit/props"
import { PrimitiveComponent } from "../base-components/PrimitiveComponent"
import { AssemblyDevice } from "./AssemblyDevice"
import { EnclosureFdmBox_doInitialEnclosureRender } from "./EnclosureFdmBox_doInitialEnclosureRender"
import { getReferencedEnclosureBoard } from "./get-referenced-enclosure-board"

export class EnclosureFdmBox extends PrimitiveComponent<
  typeof enclosureFdmBoxProps
> {
  source_fdm_enclosure_id: string | null = null

  get config() {
    return {
      componentName: "EnclosureFdmBox",
      zodProps: enclosureFdmBoxProps,
    }
  }

  /**
   * The default implementation resolves names through `getSubcircuit()`, which
   * throws for an enclosure parented by `<assembly.device>` (a product root, not
   * a subcircuit). Number unnamed boxes by their order in the tree instead so
   * two of them never collide on one source name.
   */
  override doInitialAssignNameToUnnamedComponents(): void {
    if (this._parsedProps.name) return
    let top: PrimitiveComponent = this
    while (top.parent instanceof PrimitiveComponent) top = top.parent
    const enclosureBoxes = [top, ...top.getDescendants()].filter(
      (component): component is EnclosureFdmBox =>
        component instanceof EnclosureFdmBox,
    )
    const index = enclosureBoxes.indexOf(this)
    this.fallbackUnassignedName = `unnamed_enclosure_fdm_box_${index === -1 ? 0 : index + 1}`
  }

  doInitialSourceParentAttachment(): void {
    const root = this.root!
    const board = getReferencedEnclosureBoard(this, this._parsedProps.boardRef)
    if (!board.source_board_id) {
      throw new Error(
        `Could not resolve source board for enclosure boardRef "${this._parsedProps.boardRef}"`,
      )
    }

    let parent = this.parent
    while (parent && !(parent instanceof AssemblyDevice)) {
      parent = parent.parent
    }
    let sourceAssemblyDeviceId =
      parent instanceof AssemblyDevice
        ? parent.source_assembly_device_id
        : root.db.source_assembly_device.list()[0]?.source_assembly_device_id
    if (!sourceAssemblyDeviceId) {
      sourceAssemblyDeviceId = root.db.source_assembly_device.insert(
        {},
      ).source_assembly_device_id
    }

    const props = this._parsedProps
    const sourceFdmEnclosure = root.db.source_fdm_enclosure.insert({
      source_assembly_device_id: sourceAssemblyDeviceId,
      source_board_id: board.source_board_id,
      name: props.name,
      width: props.width,
      height: props.height,
      depth: props.depth,
      wall_thickness: props.wallThickness,
      floor_thickness: props.floorThickness,
      lid_thickness: props.lidThickness,
      board_clearance: props.boardClearance,
      standoff_height: props.standoffHeight,
      top_headroom: props.topHeadroom,
      lid_lip_depth: props.lidLipDepth,
      disable_cutouts: props.disableCutouts,
    })
    this.source_fdm_enclosure_id = sourceFdmEnclosure.source_fdm_enclosure_id
  }

  doInitialEnclosureRender(): void {
    EnclosureFdmBox_doInitialEnclosureRender(this)
  }
}
