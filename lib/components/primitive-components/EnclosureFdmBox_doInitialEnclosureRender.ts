import {
  type CreateFdmEnclosureInput,
  CreateFdmEnclosureSolver,
} from "@tscircuit/create-fdm-enclosure"
import { EnclosureCutoutAperture } from "./EnclosureCutoutAperture"
import type { EnclosureFdmBox } from "./EnclosureFdmBox"
import { getReferencedEnclosureBoard } from "./get-referenced-enclosure-board"

export const EnclosureFdmBox_doInitialEnclosureRender = (
  component: EnclosureFdmBox,
): void => {
  const root = component.root
  if (!root || root.pcbDisabled) return

  const { db } = root
  const props = component._parsedProps
  const board = getReferencedEnclosureBoard(component, props.boardRef)
  const pcbBoard = board.pcb_board_id
    ? db.pcb_board.get(board.pcb_board_id)
    : null
  if (!pcbBoard?.width || !pcbBoard.height) {
    throw new Error(
      `Could not resolve dimensions for boardRef "${props.boardRef}"`,
    )
  }

  const boardThickness = pcbBoard.thickness ?? board.boardThickness
  const inputProblem: CreateFdmEnclosureInput = {
    board: {
      width: pcbBoard.width,
      height: pcbBoard.height,
      thickness: boardThickness,
    },
    width: props.width,
    height: props.height,
    depth: props.depth,
    wallThickness: props.wallThickness,
    floorThickness: props.floorThickness,
    lidThickness: props.lidThickness,
    boardClearance: props.boardClearance,
    standoffHeight: props.standoffHeight,
    topHeadroom: props.topHeadroom,
    lidLipDepth: props.lidLipDepth,
    apertures: props.disableCutouts
      ? []
      : board
          .getDescendants()
          .filter(
            (descendant): descendant is EnclosureCutoutAperture =>
              descendant instanceof EnclosureCutoutAperture,
          )
          .map((aperture) =>
            aperture.getFdmEnclosureSolverInput({
              board,
              pcbBoard,
            }),
          ),
  }

  const solver = new CreateFdmEnclosureSolver(inputProblem)
  const solverConstructorArgs = solver.getConstructorParams()
  root.emit("solver:started", {
    type: "solver:started",
    solverName: "CreateFdmEnclosureSolver",
    solverParams: solverConstructorArgs[0],
    solverConstructorArgs,
    componentName: component.getString(),
  })
  solver.solve()
  if (solver.failed) {
    throw new Error(solver.error ?? "Failed to create FDM enclosure")
  }

  const output = solver.getOutput()
  const position = {
    x: pcbBoard.center.x,
    y: pcbBoard.center.y,
    z:
      -boardThickness / 2 -
      output.dimensions.floorThickness -
      output.dimensions.standoffHeight,
  }
  if (!component.source_fdm_enclosure_id) {
    throw new Error(
      "Enclosure CAD cannot be emitted without a source_fdm_enclosure record",
    )
  }

  // One record per printed part, not one per enclosure. The parts are made and
  // handled separately, and anything looking at them needs to address them
  // separately -- hiding the lid to see the board inside is the first thing
  // anyone does with an enclosure on screen, and it is impossible if base and
  // lid arrive fused into a single plan.
  //
  // Generated enclosure parts are emitted only as typed `cad_fdm_enclosure`
  // records. They deliberately do NOT get a `cad_component`: that record
  // requires PCB ownership, which forced a synthetic zero-size pcb_component
  // whose placement and obstruction semantics then had to be disabled by hand.
  // The plan is authored in Circuit world coordinates, so none of
  // `cad_component`'s asset-normalization fields (model origin, board normal,
  // anchor, object fit) apply -- `position` alone places it.
  //
  // How a part is SHOWN is not recorded here. Translucency is a property of
  // looking at the thing, not of the thing: the geometry and every export are
  // identical either way, and the viewer already owns per-category visibility.
  // Encoding it in the circuit JSON put a rendering preference in the artifact
  // that manufacturing reads.
  for (const part of output.parts) {
    db.cad_fdm_enclosure.insert({
      source_fdm_enclosure_id: component.source_fdm_enclosure_id,
      name: component.name ? `${component.name}_${part.id}` : part.id,
      enclosure_part: part.id,
      position,
      size: {
        x: output.dimensions.width,
        y: output.dimensions.height,
        z: output.dimensions.depth,
      },
      model_jscad: part.jscadPlan,
      model_unit_to_mm_scale_factor: 1,
    })
  }
}
