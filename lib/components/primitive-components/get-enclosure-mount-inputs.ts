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

  for (const insert of inserts) {
    const hole = resolveHole(insert, root)
    if (hole) entryFor(hole).insert = insert
  }
  for (const bolt of bolts) {
    const hole = resolveHole(bolt, root)
    if (hole) entryFor(hole).bolt = bolt
  }
  for (const screw of screws) {
    const hole = resolveHole(screw, root)
    if (hole) entryFor(hole).screw = screw
  }

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
      head: "socket_cap",
      // Omitted unless authored, so create-fdm-enclosure derives it from the
      // clamped stack and rounds up to a stocked size. A screw never authors
      // one; a bolt may, and is then checked against the same bounds.
      length: bolt?._parsedProps.length,
    })
  }

  return mounts
}
