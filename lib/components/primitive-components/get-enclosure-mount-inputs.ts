import type { EnclosureMountInput } from "@tscircuit/create-fdm-enclosure"
import type { PcbBoard, PcbHole, PcbPlatedHole } from "circuit-json"
import type { PrimitiveComponent } from "../base-components/PrimitiveComponent"
import { AssemblyBolt } from "./AssemblyBolt"
import { AssemblyScrew } from "./AssemblyScrew"
import { EnclosureFdmHeatsetInsert } from "./EnclosureFdmHeatsetInsert"
import { Hole } from "./Hole"
import { PlatedHole } from "./PlatedHole"

type MountOwner = Hole | PlatedHole

const toSolverHeadRecess = (
  head: string | undefined,
  recessed: boolean,
): EnclosureMountInput["headRecess"] => {
  if (!recessed) return "none"
  return head === "countersunk" ? "countersink" : "counterbore"
}

/** Narrowest hole dimension in mm determines fastener clearance. */
const getHoleDiameterMm = (
  hole: PcbHole | PcbPlatedHole,
): number | undefined => {
  if ("hole_diameter" in hole) return hole.hole_diameter
  if (
    "hole_width" in hole &&
    "hole_height" in hole &&
    hole.hole_width !== undefined &&
    hole.hole_height !== undefined
  ) {
    return Math.min(hole.hole_width, hole.hole_height)
  }
  return undefined
}

const findAncestorHole = (
  component: PrimitiveComponent,
): MountOwner | undefined => {
  let owner = component.parent
  while (owner) {
    if (owner instanceof Hole || owner instanceof PlatedHole) return owner
    owner = owner.parent
  }
  return undefined
}

/** An ancestor hole takes precedence over holeRef. */
const resolveHole = (
  hardware: PrimitiveComponent & { getHoleSelector(): string | null },
  root: PrimitiveComponent,
): MountOwner | undefined => {
  const nested = findAncestorHole(hardware)
  if (nested) return nested

  const selector = hardware.getHoleSelector()
  if (!selector) return undefined

  const target = root.selectOne(selector)
  if (target instanceof Hole || target instanceof PlatedHole) return target
  return undefined
}

export interface GetEnclosureMountInputsParams {
  enclosureName: string
  pcbBoard: PcbBoard
  board: PrimitiveComponent
  root: PrimitiveComponent
}

export const getEnclosureMountInputs = ({
  enclosureName,
  pcbBoard,
  board,
  root,
}: GetEnclosureMountInputsParams): EnclosureMountInput[] => {
  const descendants = root.getDescendants()

  const inserts = descendants.filter(
    (d): d is EnclosureFdmHeatsetInsert =>
      d instanceof EnclosureFdmHeatsetInsert,
  )
  const bolts = descendants.filter(
    (d): d is AssemblyBolt => d instanceof AssemblyBolt,
  )

  const screws = descendants.filter(
    (d): d is AssemblyScrew => d instanceof AssemblyScrew,
  )

  const byHole = new Map<
    MountOwner,
    {
      insert?: EnclosureFdmHeatsetInsert
      bolt?: AssemblyBolt
      screw?: AssemblyScrew
    }
  >()

  const entryFor = (hole: MountOwner) => {
    let entry = byHole.get(hole)
    if (!entry) {
      entry = {}
      byHole.set(hole, entry)
    }
    return entry
  }

  // Lookup spans the assembly, but only this board's holes belong to the enclosure.
  const belongsToThisBoard = (hole: MountOwner): boolean => {
    let ancestor: PrimitiveComponent | null = hole as PrimitiveComponent
    while (ancestor) {
      if (ancestor === board) return true
      ancestor = ancestor.parent ?? null
    }
    return false
  }

  const attach = (
    piece: EnclosureFdmHeatsetInsert | AssemblyBolt | AssemblyScrew,
    kind: "insert" | "bolt" | "screw",
  ) => {
    const hole = resolveHole(piece, root)
    if (!hole) {
      throw new Error(
        `${enclosureName}: an <assembly.${kind === "insert" ? "…heatsetinsert" : kind} /> does not resolve to a hole; give it a holeRef, or nest it inside a <hole />`,
      )
    }
    if (!belongsToThisBoard(hole)) return
    const entry = entryFor(hole)
    if (entry[kind]) {
      throw new Error(
        `${enclosureName}: hole "${hole.name}" has more than one ${kind}; one hole takes one of each`,
      )
    }
    if (piece instanceof EnclosureFdmHeatsetInsert) entry.insert = piece
    else if (piece instanceof AssemblyBolt) entry.bolt = piece
    else entry.screw = piece
  }

  for (const insert of inserts) attach(insert, "insert")
  for (const bolt of bolts) attach(bolt, "bolt")
  for (const screw of screws) attach(screw, "screw")

  const db = root.root!.db
  const mounts: EnclosureMountInput[] = []
  let index = 0
  // Group-scoped hole names can repeat; solver mount ids must be unique.
  const issuedMountIds = new Set<string>()

  for (const [hole, { insert, bolt, screw }] of byHole) {
    index++
    const record =
      hole instanceof Hole
        ? db.pcb_hole.get(hole.pcb_hole_id!)
        : db.pcb_plated_hole.get(hole.pcb_plated_hole_id!)
    if (!record) {
      throw new Error(
        `${enclosureName}: the hole for a mount has not been rendered to the PCB yet`,
      )
    }
    const position = record

    if (screw && insert) {
      throw new Error(
        `${enclosureName}: hole "${hole.name}" has both an <assembly.screw /> and an <enclosure.fdm.heatsetinsert />; a screw threads into the boss itself, so pick one`,
      )
    }

    if (screw && bolt) {
      throw new Error(
        `${enclosureName}: hole "${hole.name}" has both an <assembly.screw /> and an <assembly.bolt />; a screw forms its own thread and a bolt needs one cut for it, so pick one`,
      )
    }
    if (bolt && !insert) {
      throw new Error(
        `${enclosureName}: hole "${hole.name}" has an <assembly.bolt /> but nothing for it to thread into; add an <enclosure.fdm.heatsetinsert />, or use an <assembly.screw /> to thread straight into the boss`,
      )
    }
    if (insert && !bolt) {
      throw new Error(
        `${enclosureName}: hole "${hole.name}" has an <enclosure.fdm.heatsetinsert /> but no <assembly.bolt /> going into it`,
      )
    }
    if (insert && bolt) {
      const insertThread = insert._parsedProps.thread
      const boltThread = bolt._parsedProps.thread
      if (insertThread && boltThread && insertThread !== boltThread) {
        throw new Error(
          `${enclosureName}: hole "${hole.name}" pairs an ${boltThread} bolt with an ${insertThread} insert; they have to be the same thread`,
        )
      }
    }

    const thread =
      insert?._parsedProps.thread ??
      bolt?._parsedProps.thread ??
      screw?._parsedProps.thread
    if (!thread) {
      throw new Error(
        `${enclosureName}: hole "${hole.name}" is a mount but no thread is given; add an <enclosure.fdm.heatsetinsert />, an <assembly.bolt /> or an <assembly.screw />`,
      )
    }

    let mountId = `${enclosureName}.${hole.name ?? `mount${index}`}`
    if (issuedMountIds.has(mountId)) mountId = `${mountId}#${index}`
    issuedMountIds.add(mountId)

    mounts.push({
      id: mountId,
      fastens: bolt?.getFastensLid() ? "lid" : "board",
      // Board-relative XY point in mm, matching aperture and component inputs.
      anchor: {
        x: position.x - pcbBoard.center.x,
        y: position.y - pcbBoard.center.y,
      },
      pcbHoleDiameter: getHoleDiameterMm(record),
      generatedBy: {
        elementType: record.type,
        elementId:
          hole instanceof Hole ? hole.pcb_hole_id! : hole.pcb_plated_hole_id!,
      },
      thread,
      fastening: screw ? "self_tapping" : "heat_set_insert",
      // Preserve omission and unknown head names for solver validation.
      head: (screw ?? bolt)?._parsedProps.head,
      ...(bolt?._parsedProps.headRecess !== undefined
        ? {
            headRecess: toSolverHeadRecess(
              bolt._parsedProps.head,
              bolt._parsedProps.headRecess,
            ),
          }
        : {}),
      // Explicit "none" overrides the solver's default printed lid column.
      ...(bolt?.getFastensLid()
        ? {
            lidColumn:
              bolt._parsedProps.lidColumn === "spacer"
                ? "spacer"
                : bolt._parsedProps.lidColumn
                  ? "printed"
                  : "none",
          }
        : {}),
      // An omitted length lets the solver choose a stocked size from the stack.
      length: bolt?._parsedProps.length,
      threadEngagement: screw?._parsedProps.threadEngagement,
      pilotDiameter: screw?._parsedProps.pilotDiameter,
      bottomClearance: screw?._parsedProps.bottomClearance,
      boreEntryChamfer: screw?._parsedProps.boreEntryChamfer,
      insertBottomClearance: insert?._parsedProps.bottomClearance,
      insertBoreEntryChamfer: insert?._parsedProps.boreEntryChamfer,
    })
  }

  return mounts
}
