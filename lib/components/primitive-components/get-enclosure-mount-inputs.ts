import type { EnclosureMountInput } from "@tscircuit/create-fdm-enclosure"
import type { PcbBoard } from "circuit-json"
import type { PrimitiveComponent } from "../base-components/PrimitiveComponent"
import { AssemblyBolt } from "./AssemblyBolt"
import { AssemblyScrew } from "./AssemblyScrew"
import { EnclosureFdmHeatsetInsert } from "./EnclosureFdmHeatsetInsert"
import { Hole } from "./Hole"
import { PlatedHole } from "./PlatedHole"

/**
 * Mount inputs are **joined**, not read off one element.
 *
 * `<enclosure.screwboss>` used to carry the whole fastening story on a single
 * element. The assembly-extensions RFC splits it across three places, because
 * each fact belongs to a different thing:
 *
 * - the **hole** is where the mount is;
 * - `<enclosure.fdm.heatsetinsert>` says a brass insert goes in, and its thread;
 * - `<assembly.bolt>` fastens into that insert, and may reach the lid;
 * - `<assembly.screw>` threads straight into the plastic instead.
 *
 * The fastening method is therefore carried by *which element is present*
 * rather than by a flag, so it cannot be set to a value that contradicts the
 * hardware. A screw and an insert on one hole is a contradiction, and reported
 * as one.
 *
 * So a mount is assembled per hole from whatever refers to that hole. A hole
 * with none of these is not a mount and contributes nothing.
 */

type MountOwner = Hole | PlatedHole

/** props/RFC spell threads lowercase (`m3`); the solver spells them `M3`. */
const toFastenerThread = (thread: string): EnclosureMountInput["thread"] =>
  thread.toUpperCase() as EnclosureMountInput["thread"]

/**
 * props and the model strings spell heads unspaced (`socketcap`, `panhead`);
 * the solver spells them its own way (`socket_cap`, `pan`).
 *
 * Written out rather than derived from the string, because the two vocabularies
 * do not differ by a rule -- `panhead` loses a suffix while `socketcap` gains an
 * underscore -- and a clever transformation would be a trap the first time a
 * head is added that fits neither pattern.
 */
const toSolverScrewHead = (head: string): EnclosureMountInput["head"] => {
  const solverHead = {
    socketcap: "socket_cap",
    countersunk: "countersunk",
    panhead: "pan",
    buttonhead: "button",
  }[head]
  if (!solverHead) throw new Error(`unknown screw head "${head}"`)
  return solverHead as EnclosureMountInput["head"]
}

/**
 * The drill this screw has to pass through, in millimetres.
 *
 * A non-circular hole is measured across its narrow axis, because that is what
 * stops the screw: a 3.2 x 6 slot passes an M3 and a 2 x 6 one does not, and
 * both have the same area.
 */
const getHoleDiameterMm = (
  hole: Record<string, unknown> | undefined,
): number | undefined => {
  if (!hole) return undefined
  if (typeof hole.hole_diameter === "number") return hole.hole_diameter
  const width = hole.hole_width
  const height = hole.hole_height
  if (typeof width === "number" && typeof height === "number") {
    return Math.min(width, height)
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

/**
 * The hole a piece of hardware refers to, by either accepted spelling.
 *
 * Nested wins over `holeRef` when both are present: the nesting is the more
 * specific statement, and it cannot be wrong the way a stale selector can.
 */
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
  /** Names the mount, so an error or a BOM line points back at the enclosure. */
  enclosureName: string
  pcbBoard: PcbBoard
  /** The board the mounts sit on. */
  board: PrimitiveComponent
  /** Where free-standing hardware is looked up from. */
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

  /** hole -> the hardware that refers to it */
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

  /**
   * A mount belongs to the board this enclosure was pointed at.
   *
   * Hardware is looked up from the whole tree, because a selector may reach it
   * from anywhere -- but a second board's holes are not this enclosure's
   * mounts. Without this, an enclosure for B1 grows bosses for B2's hardware,
   * placed at coordinates measured from B1's centre: hardware that is silently
   * in the wrong place rather than absent.
   */
  const belongsToThisBoard = (hole: MountOwner): boolean => {
    let ancestor: PrimitiveComponent | null = hole as PrimitiveComponent
    while (ancestor) {
      if (ancestor === board) return true
      ancestor = ancestor.parent ?? null
    }
    return false
  }

  /**
   * Attach one piece of hardware to its hole, refusing what cannot be built.
   *
   * Both failures here were silent before: an unresolved `holeRef` dropped the
   * hardware, and a second piece of the same kind overwrote the first. Either
   * way the part vanished from the enclosure and from the BOM, and the only
   * symptom was a mount that did not appear.
   */
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
    entry[kind] = piece as never
  }

  for (const insert of inserts) attach(insert, "insert")
  for (const bolt of bolts) attach(bolt, "bolt")
  for (const screw of screws) attach(screw, "screw")

  const db = root.root!.db
  const mounts: EnclosureMountInput[] = []
  let index = 0

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
    const position = record as unknown as { x: number; y: number }

    // A screw threads into the plastic; an insert puts brass in the way of it.
    // Contradictory, so say so rather than silently preferring one.
    if (screw && insert) {
      throw new Error(
        `${enclosureName}: hole "${hole.name}" has both an <assembly.screw /> and an <enclosure.fdm.heatsetinsert />; a screw threads into the boss itself, so pick one`,
      )
    }

    // A mount is one of exactly two shapes: a screw threading straight into the
    // boss, or a bolt into an insert set in it. Everything else was accepted
    // before and quietly completed -- a lone insert or a lone bolt both came out
    // as `heat_set_insert`, so the solver went and fitted the missing half
    // itself, and the enclosure was built for hardware nobody had asked for.
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

    mounts.push({
      id: `${enclosureName}.${hole.name ?? `mount${index}`}`,
      fastens: bolt?.getFastensLid() ? "lid" : "board",
      // Board-relative, as apertures are: the enclosure is centred on the
      // board, and stating the frame here keeps that assumption in one place.
      anchor: {
        x: position.x - pcbBoard.center.x,
        y: position.y - pcbBoard.center.y,
      },
      pcbHoleDiameter: getHoleDiameterMm(
        record as unknown as Record<string, unknown>,
      ),
      // Generic on purpose: a hole is what generates a boss today, but the same
      // field carries whatever generates a part tomorrow. Taken from the emitted
      // record rather than the component so it names something a consumer of the
      // Circuit JSON can actually resolve.
      generatedBy: {
        elementType: record.type,
        elementId:
          hole instanceof Hole ? hole.pcb_hole_id! : hole.pcb_plated_hole_id!,
      },
      thread: toFastenerThread(thread),
      fastening: screw ? "self_tapping" : "heat_set_insert",
      // The head belongs to whichever fastener is actually there: a screw drives
      // into the boss, a bolt into the insert, and only that one has a head
      // bearing on anything. Defaulted rather than required, so an author who
      // has not thought about heads still gets a fastener that fits.
      head: toSolverScrewHead(
        (screw ?? bolt)?._parsedProps.head ?? "socketcap",
      ),
      // Omitted unless authored, so create-fdm-enclosure derives it from the
      // clamped stack and rounds up to a stocked size. A screw never authors
      // one; a bolt may, and is then checked against the same bounds.
      length: bolt?._parsedProps.length,
    })
  }

  return mounts
}
