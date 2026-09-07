import type { FdmBoardComponent } from "@tscircuit/create-fdm-enclosure"
import type { CadComponent, PcbBoard } from "circuit-json"
import type { PrimitiveComponent } from "../base-components/PrimitiveComponent"
import { getComponentBody } from "./EnclosureCutoutAperture/get-component-body"

/**
 * Every part on the board, with native solids when available and conservative
 * envelopes otherwise, for the solver's mounting-feature clearance checks.
 *
 * Deliberately the same path an aperture uses to describe the one part it
 * serves -- `getComponentBody` over the emitted `cad_component` -- rather than a
 * second notion of what a part's extent is. An aperture and a screw boss
 * disagreeing about how big a connector is would be a very hard defect to see.
 *
 * This runs in `EnclosureRender`, after every component has emitted its
 * `cad_component`, which is why the records are all there to read.
 * Each associated CAD record stays separate, including conservative envelopes
 * alongside native solids, so an unknown model is never labeled exact.
 *
 * What is in them is another matter. A part with an authored `cadModel` carries
 * a measured size and bounds. A part whose model is only *named* by
 * `footprinter_string` carries the name, and the body behind it is built
 * downstream by the renderers -- so that body is built and measured here
 * instead, rather than letting the part arrive with pads and no height.
 *
 * Without a solid, the solver explicitly labels conservative-envelope checks.
 * Missing even a measured height leaves a footprint alone, which is reported as
 * `component_bounds_unknown` when it is near a mounting feature.
 */
export const getEnclosureBoardComponents = ({
  board,
  pcbBoard,
}: {
  board: PrimitiveComponent
  pcbBoard: PcbBoard
}): FdmBoardComponent[] => {
  const db = board.root?.db
  if (!db) return []

  const boardThickness = pcbBoard.thickness ?? 0
  const components: FdmBoardComponent[] = []
  const allCadComponents = db.cad_component.list()

  for (const descendant of board.getDescendants()) {
    const pcbComponentId = (descendant as { pcb_component_id?: string | null })
      .pcb_component_id
    if (!pcbComponentId) continue
    const pcbComponent = db.pcb_component.get(pcbComponentId)
    if (!pcbComponent?.center) continue

    const boardSide = pcbComponent.layer === "bottom" ? "bottom" : "top"
    const cadComponents: Array<CadComponent | null> = allCadComponents.filter(
      (cad) => cad.pcb_component_id === pcbComponentId,
    )
    // A component without CAD still contributes its footprint-only fallback.
    if (cadComponents.length === 0) cadComponents.push(null)
    const componentId = descendant.getString()

    for (const cadComponent of cadComponents) {
      const { bounds, solid, ...body } = getComponentBody({
        owner: descendant,
        pcbComponent,
        cadComponent,
        // The face this part is mounted on, which is the datum its reach above
        // the board is measured from.
        boardSurfaceZ: (boardSide === "bottom" ? -1 : 1) * (boardThickness / 2),
        boardCenter: pcbBoard.center,
      })

      components.push({
        id:
          cadComponents.length > 1 && cadComponent
            ? `${componentId}:${cadComponent.cad_component_id}`
            : componentId,
        // Board-relative, the frame `mounts` and apertures both state: the solver
        // differences a mount's anchor against these directly
        // (`checkComponentClearance`), so an absolute centre here offsets every
        // part from every boss by the board's own placement. Same expression as
        // the mount path in `get-enclosure-mount-inputs.ts` and the aperture path
        // in `EnclosureCutoutAperture/get-fdm-enclosure-solver-input.ts`.
        center: {
          x: bounds
            ? (bounds.min.x + bounds.max.x) / 2
            : (cadComponent?.position.x ?? pcbComponent.center.x) -
              pcbBoard.center.x,
          y: bounds
            ? (bounds.min.y + bounds.max.y) / 2
            : (cadComponent?.position.y ?? pcbComponent.center.y) -
              pcbBoard.center.y,
        },
        boardSide,
        body,
        solid,
      })
    }
  }

  return components
}
