import type { EnclosureBoardComponent } from "@tscircuit/create-fdm-enclosure"
import type { CadComponent, PcbBoard } from "circuit-json"
import type { PrimitiveComponent } from "../base-components/PrimitiveComponent"
import { getComponentBody } from "./EnclosureCutoutAperture/get-component-body"
import { measureFootprinterBody } from "./measure-footprinter-body"

/**
 * Every part on the board, as envelopes the enclosure solver can check its
 * mounting features against.
 *
 * Deliberately the same path an aperture uses to describe the one part it
 * serves -- `getComponentBody` over the emitted `cad_component` -- rather than a
 * second notion of what a part's extent is. An aperture and a screw boss
 * disagreeing about how big a connector is would be a very hard defect to see.
 *
 * This runs in `CadModelRender`, after every component has emitted its
 * `cad_component`, which is why the records are all there to read.
 *
 * What is in them is another matter. A part with an authored `cadModel` carries
 * a measured size and bounds. A part whose model is only *named* by
 * `footprinter_string` carries the name, and the body behind it is built
 * downstream by the renderers -- so that body is built and measured here
 * instead, rather than letting the part arrive with pads and no height.
 *
 * Anything still unmeasured after both paths reaches the solver with a footprint
 * alone, and is reported as undecidable rather than clear; see
 * `component_bounds_unknown`.
 */
export const getEnclosureBoardComponents = ({
  board,
  pcbBoard,
}: {
  board: PrimitiveComponent
  pcbBoard: PcbBoard
}): EnclosureBoardComponent[] => {
  const db = board.root?.db
  if (!db) return []

  const boardThickness = pcbBoard.thickness ?? 0
  const components: EnclosureBoardComponent[] = []

  for (const descendant of board.getDescendants()) {
    const pcbComponentId = (descendant as { pcb_component_id?: string | null })
      .pcb_component_id
    if (!pcbComponentId) continue
    const pcbComponent = db.pcb_component.get(pcbComponentId)
    if (!pcbComponent?.center) continue

    const boardSide = pcbComponent.layer === "bottom" ? "bottom" : "top"
    const cadComponent = (db.cad_component.getWhere({
      pcb_component_id: pcbComponentId,
    }) ?? null) as CadComponent | null

    const body = getComponentBody({
      owner: descendant,
      pcbComponent,
      cadComponent,
      // The face this part is mounted on, which is the datum its reach above
      // the board is measured from.
      boardSurfaceZ: (boardSide === "bottom" ? -1 : 1) * (boardThickness / 2),
    })

    // Only where the authored model did not already say. A `cadModel` is the
    // part someone actually specified; a footprinter body is the generic one
    // behind its name, and should never override it.
    const footprinterString = cadComponent?.footprinter_string
    if (
      footprinterString &&
      body.aboveBoardHeight === undefined &&
      body.size === undefined
    ) {
      const measured = measureFootprinterBody(footprinterString)
      if (measured) {
        body.size = measured.size
        // The measurement's own frame puts z = 0 at the board surface, so the
        // top of the body is the reach directly. This is the honest number
        // `size.z` is not: for a through-hole part `size.z` also spans the pins
        // below the board.
        body.aboveBoardHeight = measured.zMax
      }
    }

    components.push({
      id: descendant.getString(),
      center: { x: pcbComponent.center.x, y: pcbComponent.center.y },
      boardSide,
      body,
    })
  }

  return components
}
