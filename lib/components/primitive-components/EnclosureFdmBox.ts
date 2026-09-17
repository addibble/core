import { enclosureFdmBoxProps } from "@tscircuit/props"
import { getElementId } from "@tscircuit/circuit-json-util"
import type { AnyCircuitElement } from "circuit-json"
import type { RenderPhase } from "../base-components/Renderable"
import type { Board } from "../normal-components/Board"
import { PrimitiveComponent } from "../base-components/PrimitiveComponent"
import { EnclosureFdmBox_doInitialCadModelRender } from "./EnclosureFdmBox_doInitialCadModelRender"
import { getReferencedEnclosureBoard } from "./get-referenced-enclosure-board"

export class EnclosureFdmBox extends PrimitiveComponent<
  typeof enclosureFdmBoxProps
> {
  generatedElements: AnyCircuitElement[] = []
  lastEnclosureInput: string | null = null
  generatedForBoard: Board | null = null

  insertGeneratedElement(
    element: Extract<
      AnyCircuitElement,
      {
        type:
          | "source_component"
          | "pcb_component"
          | "cad_component"
          | "pcb_keepout"
          | "pcb_placement_error"
      }
    >,
  ): void {
    const { db } = this.root!
    // Typed table inserts preserve the explicit ownership ID; the generic
    // db.insert API always allocates a new one.
    switch (element.type) {
      case "source_component":
        this.generatedElements.push(db.source_component.insert(element))
        break
      case "pcb_component":
        this.generatedElements.push(db.pcb_component.insert(element))
        break
      case "cad_component":
        this.generatedElements.push(db.cad_component.insert(element))
        break
      case "pcb_keepout":
        this.generatedElements.push(db.pcb_keepout.insert(element))
        break
      case "pcb_placement_error":
        this.generatedElements.push(db.pcb_placement_error.insert(element))
        break
    }
  }

  clearGeneratedElements(): void {
    for (const element of this.generatedElements) {
      this.root!.db[element.type].delete(getElementId(element))
    }
    this.generatedElements = []
    this.cad_component_id = null
  }

  get config() {
    return {
      componentName: "EnclosureFdmBox",
      zodProps: enclosureFdmBoxProps,
    }
  }

  /** assembly.device is a product container, not a subcircuit naming scope. */
  override doInitialAssignNameToUnnamedComponents(): void {
    if ((this._parsedProps as { name?: string }).name) return
    let top: PrimitiveComponent = this
    while (top.parent instanceof PrimitiveComponent) top = top.parent
    const enclosureBoxes = [top, ...top.getDescendants()].filter(
      (component): component is EnclosureFdmBox =>
        component instanceof EnclosureFdmBox,
    )
    const index = enclosureBoxes.indexOf(this)
    this.fallbackUnassignedName = `unnamed_enclosure_fdm_box_${index === -1 ? 0 : index + 1}`
  }

  doInitialSourceRender(): void {
    const sourceComponent = this.root!.db.source_component.insert({
      ftype: "simple_chip",
      name: this.name,
    })
    this.source_component_id = sourceComponent.source_component_id
  }

  doInitialPcbComponentRender(): void {
    const root = this.root
    if (!root || root.pcbDisabled || !this.source_component_id) return

    const board = getReferencedEnclosureBoard(this, this._parsedProps.boardRef)
    const pcbBoard = board.pcb_board_id
      ? root.db.pcb_board.get(board.pcb_board_id)
      : null
    const center = pcbBoard?.center ?? board._getGlobalPcbPositionBeforeLayout()
    const pcbComponent = root.db.pcb_component.insert({
      center,
      width: 0,
      height: 0,
      layer: "top",
      rotation: 0,
      source_component_id: this.source_component_id,
      obstructs_within_bounds: false,
      do_not_place: true,
      is_allowed_to_be_off_board: true,
    })
    this.pcb_component_id = pcbComponent.pcb_component_id
  }

  override runRenderPhase(phase: RenderPhase): void {
    // Sibling board edits do not dirty this assembly-level primitive. Compare
    // solver inputs after CAD on each cycle, without invalidating PCB routing.
    if (phase === "EnclosureRender") {
      this.renderPhaseStates.EnclosureRender.dirty = true
    }
    super.runRenderPhase(phase)
  }

  doInitialEnclosureRender(): void {
    EnclosureFdmBox_doInitialCadModelRender(this)
  }

  updateEnclosureRender(): void {
    EnclosureFdmBox_doInitialCadModelRender(this)
  }

  removeEnclosureRender(): void {
    this.clearGeneratedElements()
    if (this.generatedForBoard) {
      this.generatedForBoard._enclosureDrcNeedsRefresh = true
      this.generatedForBoard._generatedEnclosures.delete(this)
    }
    this.generatedForBoard = null
    this.lastEnclosureInput = null
  }
}
