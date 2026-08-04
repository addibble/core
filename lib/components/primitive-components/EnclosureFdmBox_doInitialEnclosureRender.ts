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

  // Generated enclosure parts are emitted only as typed `cad_fdm_enclosure`
  // records. They deliberately do NOT get a `cad_component`: that record
  // requires PCB ownership, which forced a synthetic zero-size pcb_component
  // whose placement and obstruction semantics then had to be disabled by hand.
  // The plan is authored in Circuit world coordinates, so none of
  // `cad_component`'s asset-normalization fields (model origin, board normal,
  // anchor, object fit) apply -- `position` alone places it.
  db.cad_fdm_enclosure.insert({
    source_fdm_enclosure_id: component.source_fdm_enclosure_id,
    name: component.name,
    position,
    size: {
      x: output.dimensions.width,
      y: output.dimensions.height,
      z: output.dimensions.depth,
    },
    model_jscad: output.jscadPlan,
    model_unit_to_mm_scale_factor: 1,
    // Presentation only: the JSCAD plan is unchanged, so exports are identical
    // either way. An opaque box hides the board it was generated from, which is
    // exactly what you want to see while checking openings against parts.
    show_as_translucent_model:
      component._parsedProps.showAsTranslucentModel ?? false,
  })
}
